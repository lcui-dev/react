import React, { ReactElement, ReactNode } from "react";
import {
  call,
  ComponentContext,
  createFunctionContext,
  getComponentContext,
  setComponentContext,
  isObjectBinding,
  compiler,
} from "./binding";
import fmt from "./fmt";

type Element<T = { $ref?: string }> = ReactElement<
  T,
  {
    displayName?: string;
    shouldPreRender?: boolean;
    (props: T): ReactElement;
  }
>;

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

function transformNodeStyle(node: Node, style: Record<string, any>) {
  const ctx = getComponentContext();
  const ref = node.attributes.ref || `ref_${ctx.refs.length}`;

  ctx.refs.push(ref);
  node.attributes.ref = ref;
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
    const ref = node.attributes.ref || `text_ref_${ctx.refs.length}`;

    ctx.refs.push(ref);
    ctx.body.push(
      `ui_widget_set_text(_that->refs.${ref}, ${str.__meta__.name})`
    );
    return;
  }
  node.children = node.children.map((child) => {
    if (typeof child === "string") {
      return {
        ...createNode("text"),
        text: child,
      };
    }
    if (isObjectBinding(child)) {
      const str = fmt(child);
      const childNode = createNode("text");
      const ref = `ref_${ctx.refs.length}`;

      childNode.attributes.ref = ref;
      ctx.refs.push(ref);
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
      value = transformEventHandler(
        key.substring(2).toLocaleLowerCase(),
        value
      );
    }
    // TODO: 处理 ref
    // TODO: 处理 style 属性的数据绑定
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
  return node;
}

function transformEventHandler(eventName: string, handler: Function) {
  const ctx = getComponentContext();
  let decl = ctx.eventHandlers.find((item) => item.handler == handler);
  if (decl) {
    return decl.context.name;
  }

  const name =
    handler.name || `${eventName}_handler_${ctx.eventHandlers.length}`;
  decl = {
    eventName,
    handler,
    context: createFunctionContext(name),
  };
  ctx.eventHandlers.push(decl);
  call(handler, decl.context);
  return name;
}

export default function transform<T = {}>(componentFunc: React.FC<T>) {
  const newFunc = (props: T) => {
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
      generatedCode: [
        compiler.compileComponentState(ctx),
        compiler.compileComponentEventHandlers(ctx),
        compiler.compileComponentMethods(ctx),
      ].join("\n"),
    };
  };
  newFunc.name = componentFunc.name;
  newFunc.origin = componentFunc;
  return newFunc;
}
