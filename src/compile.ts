import React, { ReactElement, ReactNode } from "react";
import {
  call,
  ComponentContext,
  createFunctionContext,
  getComponentContext,
  setComponentContext,
  isObjectBinding,
  compiler,
} from "./binding.js";
import fmt from "./fmt.js";

type ComponentFunction<T = {}> = {
  displayName?: string;
  shouldPreRender?: boolean;
  (props: T): ReactElement;
};

type Element<T = { $ref?: string }> = ReactElement<T, ComponentFunction<T>>;

function isElement(el: ReactElement): el is Element {
  return typeof el.type === "function";
}

function createNode(name = "") {
  return {
    type: "element",
    name: "",
    text: "",
    attributes: {} as Record<string, string>,
    children: [],
  };
}

type Node = ReturnType<typeof createNode>;

function allocRef(ctx, node, prefix = "ref_") {
  const ref = node.attributes.ref || `${prefix}${ctx.refs.length}`;
  ctx.refs.push(ref);
  node.attributes.ref = ref;
  return ref;
}

function transformNodeStyle(node: Node, style: Record<string, any>) {
  const ctx = getComponentContext();
  const ref = allocRef(ctx, node);

  Object.keys(style).forEach((key) => {
    const value = style[key];
    const propKey = key.toLocaleLowerCase();
    let identify = `unknown_${typeof value}`;

    if (isObjectBinding(value)) {
      identify = value.__meta__.name;
    } else if (typeof value === "number" || typeof value == "string") {
      identify = `"${value}"`;
    }
    ctx.body.push(
      `ui_widget_set_style_string(_that->refs.${ref}, ${propKey}, ${identify})`
    );
  });
}

function transformNodeChildren(node: Node, rawChildren: ReactNode[]) {
  let isPureText = true;
  let needFormat = false;
  const children = [];

  React.Children.forEach(rawChildren, (child) => {
    switch (typeof child) {
      case "string":
      case "number":
        children.push(`${child}`);
        break;
      case "object":
        if (child) {
          if (isObjectBinding(child)) {
            needFormat = true;
            children.push(child);
          } else if (React.isValidElement(child)) {
            isPureText = false;
            children.push(child);
          }
          break;
        }
      default:
        break;
    }
  });
  if (isPureText) {
    node.text = children.join("");
    return;
  }

  const ctx = getComponentContext();
  if (needFormat) {
    const str = fmt(...children);
    const ref = allocRef(ctx, node, "text_ref");

    ctx.body.push(
      `ui_widget_set_text(_that->refs.${ref}, ${str.__meta__.name})`
    );
    return;
  }

  node.children = children.map((child) => {
    if (typeof child === "string") {
      return {
        ...createNode("text"),
        text: child,
      };
    }
    if (isObjectBinding(child)) {
      const str = fmt(child);
      const childNode = createNode("text");
      const ref = allocRef(ctx, childNode);

      ctx.body.push(
        `ui_widget_set_text(_that->refs.${ref}, ${str.__meta__.name})`
      );
      return childNode;
    }
    return transformReactNode(child);
  });
}

function transformReactNode(el: ReactNode) {
  let node = createNode();

  if (!React.isValidElement(el)) {
    return;
  }
  if (el.type === React.Fragment) {
    throw new SyntaxError("React.Fragment is not supported");
  }
  if (typeof el.type === "string") {
    switch (el.type) {
      case "div":
      case "w":
      case "widget":
        node.name = "widget";
        break;
      default:
        node.name = el.type;
        break;
    }
  } else if (isElement(el)) {
    if (el.type.shouldPreRender) {
      const newNode = transformReactNode(el.type(el.props));
      if (el.props.$ref) {
        newNode.attributes.ref = el.props.$ref;
      }
      return newNode;
    }
    node.name = el.type.displayName || el.type.name;
  } else {
    return;
  }

  const attrMap = {
    className: "class",
    $ref: "ref",
  };
  const handlerNames = [];

  Object.keys(el.props).forEach((propKey) => {
    let key = propKey;
    let value = el.props[key];

    if (key in attrMap) {
      key = attrMap[key];
    }
    if (key === "children" || key === "style") {
      return;
    }
    if (key.startsWith("on")) {
      handlerNames.push(key);
      return;
    }
    // TODO: 处理 ref
    if (typeof value !== "undefined") {
      node.attributes[key] = value;
    }
  });
  if (el.props.children) {
    transformNodeChildren(node, el.props.children);
  }
  if (el.props.style) {
    if (typeof node.attributes.style !== "object") {
      throw SyntaxError("The style attribute value must be an object");
    }
    transformNodeStyle(node, el.props.style);
  }
  handlerNames.forEach((name) => {
    transformEventHandler(
      node,
      name.substring(2).toLocaleLowerCase(),
      el.props[name]
    );
  });
  return node;
}

function transformEventHandler(
  node: Node,
  eventName: string,
  handler: Function
) {
  const ctx = getComponentContext();
  const ref = allocRef(ctx, node);
  let decl = ctx.eventHandlers.find((item) => item.handler == handler);
  if (decl) {
    return decl.context.name;
  }

  const name = ["handle", node.name, eventName, ctx.eventHandlers.length].join(
    "_"
  );
  decl = {
    target: ref,
    eventName,
    handler,
    context: createFunctionContext(name),
  };
  ctx.eventHandlers.push(decl);
  call(handler, decl.context);
  return name;
}

export default function compile<T = {}>(componentFunc: ComponentFunction<T>, props: T) {
  const ctx: ComponentContext = {
    ...createFunctionContext(componentFunc.displayName || componentFunc.name),
    kind: "ComponentContext",
    state: [],
    eventHandlers: [],
    stateNames: `${componentFunc}`
      .split(/\r|\n/)
      .filter((line) => line.includes("useState"))
      .map((line) => {
        const index = line.indexOf("useState");
        if (index < 0) {
          return "";
        }
        const decl = line
          .substring(0, index)
          .replace(/(const|let|var)\s/, "")
          .trim();
        const bracketLeft = decl.indexOf("[");
        if (bracketLeft >= 0) {
          return decl.substring(bracketLeft + 1).split(/\]|,/)[0];
        }
        return decl;
      }),
    refs: [],
  };

  setComponentContext(ctx);
  const root = transformReactNode(componentFunc(props));
  return {
    name: ctx.name,
    node: root,
    refs: ctx.refs,
    typesCode: compiler.compileTypes(ctx),
    reactCode: compiler.compileComponent(ctx),
    declarationCode: `void ui_register_${ctx.name}(void);

ui_widget_t *ui_create_${ctx.name}(void);

void ${ctx.name}_update(ui_widget_t *w);
`,
    sourceCode: `typedef struct {
        ${ctx.name}_react_t base;
        // Add additional states to your component here
        // ...
} ${ctx.name}_t;

static void ${ctx.name}_init(ui_widget_t *w)
{
        ui_widget_add_data(${ctx.name}_proto, sizeof(${ctx.name}_t));
        ${ctx.name}_react_init(w);
        // Write the initialization code for your component here
        // such as state initialization, event binding, etc
        // ...
}

void ${ctx.name}_update(ui_widget_t *w)
{
        ${ctx.name}_react_update(w);
        // Write the update code for your component here
        // ...
}

ui_widget_t *ui_create_${ctx.name}(void)
{
        return ui_create_widget_with_prototype(${ctx.name}_proto);
}

void ui_register_${ctx.name}(void)
{
        ${ctx.name}_init_prototype();
        ${ctx.name}_proto->init = ${ctx.name}_init;
        ${ctx.name}_proto->destroy = ${ctx.name}_destroy;
}
`
  };
}
