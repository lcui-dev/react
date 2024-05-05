import React, { ReactElement, ReactNode, isValidElement } from "react";
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
import { JSXObjectBinding } from "./jsx-runtime.js";
import { RouterView } from "./widgets.js";

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
    name,
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

const toDashCase = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function transformNodeStyle(node: Node, style: Record<string, any>) {
  const ctx = getComponentContext();
  const ref = allocRef(ctx, node);

  Object.keys(style).forEach((key) => {
    const value = style[key];
    const propKey = toDashCase(key);
    let identify = `unknown_${typeof value}`;

    if (isObjectBinding(value)) {
      identify = value.__meta__.name;
    } else if (typeof value === "number" || typeof value == "string") {
      identify = `"${value}"`;
    }
    ctx.body.push(
      `ui_widget_set_style_string(_that->refs.${ref}, "${propKey}", ${identify})`
    );
  });
}

function transformNodeChildren(node: Node, rawChildren: ReactNode[]) {
  let isPureText = true;
  let needFormat = true;
  const children = [];

  React.Children.forEach(rawChildren, (child) => {
    switch (typeof child) {
      case "string":
      case "number":
        children.push(`${child}`);
        break;
      case "object":
        if (isValidElement(child)) {
          isPureText = false;
          if (child.type === JSXObjectBinding) {
            children.push(child.props.value);
          } else {
            needFormat = false;
            children.push(child);
          }
        }
        break;
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
      return transformReactNode(el.type(el.props));
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
    if (typeof value !== "undefined") {
      node.attributes[key] = value;
    }
  });
  const ref = node.attributes.ref as string | Record<string, any>;
  // TODO: 将事件处理函数放到 ref 生成后执行
  if (ref && typeof ref !== "string") {
    node.attributes.ref = ref.name;
    ref.current.type = typeof el.type === "string" ? el.type : el.type.name;
  }
  if (el.props.children) {
    transformNodeChildren(node, el.props.children);
  }
  if (el.props.style) {
    if (typeof el.props.style !== "object") {
      throw SyntaxError(
        `The style attribute value must be an object, not ${typeof el.props
          .style}`
      );
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

function parseHookValueNames(funcStr: string, hook: string) {
  return funcStr
    .split(/\r|\n/)
    .filter((line) => line.includes(hook))
    .map((line) => {
      const index = line.indexOf(hook);
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
      return decl.split("=")[0].trim();
    });
}

export default function compile<T = {}>(
  componentFunc: ComponentFunction<T>,
  props: T,
  options: { target?: "Widget" | "AppRouter"; name?: string }
) {
  const funcStr = `${componentFunc}`;
  const ctx: ComponentContext = {
    ...createFunctionContext(
      options?.name || componentFunc.displayName || componentFunc.name
    ),
    kind: "ComponentContext",
    state: [],
    refs: [],
    eventHandlers: [],
    stateNames: parseHookValueNames(funcStr, "useState"),
    refNames: parseHookValueNames(funcStr, "useRef"),
    headerFiles: new Set(),
  };

  setComponentContext(ctx);

  let el;
  switch (options?.target) {
    case "AppRouter":
      el = componentFunc({
        ...props,
        children: React.createElement(RouterView),
      });
      break;
    default:
      el = componentFunc(props);
      break;
  }

  return {
    name: options.name || ctx.name,
    node: transformReactNode(el),
    refs: ctx.refs,
    headerFiles: Array.from(ctx.headerFiles),
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
        ui_widget_add_data(w, ${ctx.name}_proto, sizeof(${ctx.name}_t));
        ${ctx.name}_react_init(w);
        // Write the initialization code for your component here
        // such as state initialization, event binding, etc
        // ...
}

static void ${ctx.name}_destroy(ui_widget_t *w)
{
        // Write code here to destroy the relevant resources of the component
        // ...

        ${ctx.name}_react_destroy(w);
}

void ${ctx.name}_update(ui_widget_t *w)
{
        ${ctx.name}_react_update(w);
        // Write code here to update other content of your component
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
`,
  };
}
