import React, { ReactNode, cloneElement, isValidElement } from "react";

export type Value = string | number | boolean | object | null | ObjectBinding;

export enum SyntaxKind {
  Unknown,
  StringLiteral,
  NumericLiteral,
  CallExpression,
  NewExpression,
}

export enum CType {
  Unknown,
  Int,
  Boolean,
  Size,
  Double,
  String,
  Object,
}

const cNumericTypes = [CType.Int, CType.Size, CType.Double] as const;
type CNumericType = (typeof cNumericTypes)[number];

interface Node {
  kind: SyntaxKind;
}

interface CallExpression extends Node {
  kind: SyntaxKind.CallExpression;
  identifier: string;
  arguments: Value[];
}

interface NewExpression extends Omit<CallExpression, "kind"> {
  kind: SyntaxKind.NewExpression;
}

interface StringLiteral extends Node {
  kind: SyntaxKind.StringLiteral;
  text: string;
}

interface NumericLiteral extends Node {
  kind: SyntaxKind.NumericLiteral;
  text: string;
  type: CNumericType;
}

type InitializerExpression =
  | NumericLiteral
  | StringLiteral
  | NewExpression
  | ObjectBinding;

interface VariableDeclaration {
  identifier: string;
  initializer: ObjectBinding;
}

interface FunctionContext {
  kind: string;
  name: string;
  locals: VariableDeclaration[];
  body: string[];
  hasStateOperation: boolean;
}

interface EventHandlerDeclaration {
  eventName: string;
  handler: Function;
  context: FunctionContext;
}

interface ComponentContext extends FunctionContext {
  kind: "ComponentContext";
  state: VariableDeclaration[];
  stateNames: string[];
  eventHandlers: EventHandlerDeclaration[];
  refs: any[];
}

enum BindingKind {
  Object,
  Module,
}

interface ModuleBindingMeta {
  kind: BindingKind.Module;
  name: string;
  file: string;
}

interface ObjectBindingMeta {
  kind: BindingKind.Object;
  name: string;
  owner?: BindingBase;
  type: CType;
  initializer?: InitializerExpression;
}

type BindingMeta = ModuleBindingMeta | ObjectBindingMeta;

interface BindingBase<T = BindingMeta> {
  __meta__: T;
  (...arg: Value[]): Value;
  new (...arg: Value[]): Binding;
}

export type Binding<T = BindingMeta> = BindingBase<T> & {
  [key: string]: Binding;
};
export type ObjectBinding = Binding<ObjectBindingMeta>;

const typeNameMap = {
  [CType.Double]: "double",
  [CType.Size]: "size_t",
  [CType.Int]: "int",
  [CType.String]: "char*",
};

export function getObjectTypeName(obj: ObjectBinding) {
  const init = obj.__meta__.initializer;
  const typeName = typeNameMap[obj.__meta__.type];

  if (typeName) {
    return typeName;
  }
  if (!init) {
    throw new SyntaxError("missing initializer");
  }
  if (isObjectBinding(init)) {
    return init.__meta__.name;
  }
  switch (init.kind) {
    case SyntaxKind.NumericLiteral:
      return typeNameMap[init.type];
    case SyntaxKind.StringLiteral:
      return typeNameMap[CType.String];
    case SyntaxKind.NewExpression:
      return init.identifier;
    default:
      break;
  }
  return "unknown";
}

export function getTypeName(value: Value) {
  if (isObjectBinding(value)) {
    return getObjectTypeName(value);
  }
  return typeof value;
}

export function toClassName(typeName: string) {
  return typeName.endsWith("_t")
    ? typeName.substring(0, typeName.length - 1)
    : typeName;
}

export function getInitializerName(typeName: string) {
  return `${toClassName(typeName)}_create`;
}

export function getDestroyerName(typeName: string) {
  return `${toClassName(typeName)}_destroy`;
}

function resolveBindingIdentify(b: ObjectBinding) {
  // TODO: 考虑 b.owner 存在的情况
  return b.__meta__.name || "unnamed_obj";
}

function compileCallExpression(identifier: string, args: Value[]) {
  const argsStr = args
    .map((arg) => {
      switch (typeof arg) {
        case "string":
          return JSON.stringify(arg);
        case "number":
        case "boolean":
          return `${arg}`;
        case "undefined":
          return "NULL";
        case "object":
          if (arg === null) {
            return "NULL";
          }
          if (isObjectBinding(arg)) {
            return resolveBindingIdentify(arg);
          }
        default:
          break;
      }
      return `unsupported_type_${typeof arg}`;
    })
    .join(", ");
  return `${identifier}(${argsStr})`;
}

export function createStringBinding(name: string, value: string | null = null) {
  return createObjectBinding({
    name,
    type: CType.String,
    initializer: createStringLiteral(value),
  });
}

export function createStringVariable(value: string | null = null) {
  const ctx = getFunctionContext();
  const identifier = `str_${ctx.locals.length}`;
  const binding = createStringBinding(identifier, value);

  ctx.locals.push({
    identifier,
    initializer: binding,
  });
  return binding;
}

export function createVariable(typeName: string, args: Value[] = []) {
  const ctx = getFunctionContext();
  const identifier = `obj_${ctx.locals.length}`;
  const binding = createObjectBinding({
    name: identifier,
    type: CType.Object,
    initializer: {
      kind: SyntaxKind.NewExpression,
      identifier: typeName,
      arguments: args,
    },
  });

  ctx.locals.push({
    identifier,
    initializer: binding,
  });
  return binding;
}

function compileObjectInitializer(obj: ObjectBinding) {
  const init = obj.__meta__.initializer;

  if (!init) {
    throw new SyntaxError("missing initializer");
  }
  switch (init.kind) {
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.StringLiteral:
      return init.text;
    case SyntaxKind.NewExpression:
      return `${compileCallExpression(
        getInitializerName(init.identifier),
        init.arguments
      )}`;
    default:
      break;
  }
  return "";
}

function compileVariableDeclaration(decl: VariableDeclaration) {
  return `${getObjectTypeName(decl.initializer)} ${
    decl.identifier
  } = ${compileObjectInitializer(decl.initializer)}`;
}

export function compileObjectDestroyer(obj: ObjectBinding) {
  const init = obj.__meta__.initializer;

  if (!init) {
    throw new SyntaxError("missing initializer");
  }
  switch (init.kind) {
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.StringLiteral:
      break;
    case SyntaxKind.NewExpression:
      return `${getDestroyerName(init.identifier)}(${obj.name})`;
    default:
      break;
  }
  return "";
}

let contextList: FunctionContext[] = [];

export function getFunctionContext() {
  if (contextList.length < 2) {
    throw new SyntaxError("FunctionContext is missing");
  }
  return contextList[contextList.length - 1];
}

export function getComponentContext() {
  if (contextList[0]?.kind !== "ComponentContext") {
    throw new SyntaxError(
      "The createState function must be called in a component function"
    );
  }
  return contextList[0] as ComponentContext;
}

export function pushFunctionComponent(ctx: FunctionContext) {
  contextList.push(ctx);
}

export function popFunctionComponent(ctx: FunctionContext) {
  contextList.push(ctx);
}

export function setComponentContext(ctx: ComponentContext) {
  contextList = [ctx];
}

function createNumericLiteral(num: number, type: CNumericType): NumericLiteral {
  return {
    kind: SyntaxKind.NumericLiteral,
    text: `${num}`,
    type,
  };
}

function createStringLiteral(value: string | null = null): StringLiteral {
  return {
    kind: SyntaxKind.StringLiteral,
    text: value === null ? "NULL" : JSON.stringify(value),
  };
}

function createBinding(meta: BindingMeta) {
  const binding = new Proxy(
    { __meta__: meta },
    {
      get(target, p, receiver) {
        if (p in target) {
          return target[p];
        }
        if (typeof p !== "string") {
          return null;
        }
        return createBinding({
          kind: BindingKind.Object,
          owner: receiver,
          type: CType.Object,
          name: p,
        });
      },
      construct(target, args) {
        if (target.__meta__.kind !== BindingKind.Object) {
          throw new SyntaxError("Module cannot be used as a constructor");
        }
        if (!meta.name) {
          throw new SyntaxError("Constructor has no name");
        }
        return createVariable(meta.name, args);
      },
      apply(target: Binding, _thisArg, args) {
        if (target.__meta__.kind === BindingKind.Module) {
          throw new SyntaxError("Module cannot be used as a function");
        }
        const ctx = getFunctionContext();
        ctx.body.push(
          compileCallExpression(
            resolveBindingIdentify(target as ObjectBinding),
            args
          )
        );
      },
    }
  ) as Binding;
  return binding;
}

export function createObjectBinding(meta: Omit<ObjectBindingMeta, "kind">) {
  return createBinding({ ...meta, kind: BindingKind.Object }) as ObjectBinding;
}

export function isObjectBinding(val: any): val is ObjectBinding {
  return typeof val === "object" && "__meta__" in val;
}

function stringifyBinding(obj: ObjectBinding) {
  const ctx = getFunctionContext();
  switch (obj.__meta__.type) {
    case CType.String:
      return obj;
    case CType.Object: {
      const typeName = getObjectTypeName(obj);
      const str = createStringVariable();
      ctx.body.push(
        `${str.__meta__.name} = ${toClassName(typeName)}_to_string(${
          obj.__meta__.name
        })`
      );
    }
    case CType.Double: {
      const str = createStringVariable();
      ctx.body.push(
        `${str.__meta__.name} = malloc(sizeof(char) * 32)`,
        `snprintf(${str.__meta__.name}, 31, "%lf", ${obj.__meta__.name})`,
        `${str.__meta__.name}[31] = 0`
      );
      return str;
    }
    case CType.Int: {
      const str = createStringVariable();
      ctx.body.push(
        `${str.__meta__.name} = malloc(sizeof(char) * 32)`,
        `snprintf(${str.__meta__.name}, 31, "%d", ${obj.__meta__.name})`,
        `${str.__meta__.name}[31] = 0`
      );
      return str;
    }
    case CType.Size: {
      const str = createStringVariable();
      ctx.body.push(
        `${str.__meta__.name} = malloc(sizeof(char) * 32)`,
        `snprintf(${str.__meta__.name}, 31, "%zu", ${obj.__meta__.name})`,
        `${str.__meta__.name}[31] = 0`
      );
      return str;
    }
    default:
      break;
  }
  throw SyntaxError(
    `Unable to convert object ${obj.__meta__.name} to a string`
  );
}

export function stringifyValue(value: Value) {
  switch (typeof value) {
    case "string":
      return createStringVariable(value);
    case "boolean":
    case "number":
      return createStringVariable(`${value}`);
    case "undefined":
      return createStringVariable("undefined");
    case "object":
      if (value === null) {
        return createStringVariable();
      }
      if (isObjectBinding(value)) {
        return stringifyBinding(value);
      }
    default:
      break;
  }
  throw SyntaxError(`Unable to convert ${typeof value} to a string`);
}

export function isNumericType(t: CType): t is CNumericType {
  return cNumericTypes.includes(t as CNumericType);
}

export function isNumeric(obj: ObjectBinding) {
  return isNumericType(obj.__meta__.type);
}

export function isString(obj: ObjectBinding) {
  return obj.__meta__.type === CType.String;
}

function setObjectBindingValue(obj: ObjectBinding, newValue: Value) {
  const ctx = getFunctionContext();

  ctx.hasStateOperation = true;
  if (obj.__meta__.type === CType.String) {
    const str = stringifyValue(newValue);
    ctx.body.push(
      compileObjectDestroyer(obj),
      `${obj.__meta__.name} = ${str.__meta__.name}`
    );
    return;
  }
  if (isNumericType(obj.__meta__.type)) {
    let right: string;
    const typeName = typeNameMap[obj.__meta__.type];

    switch (typeof newValue) {
      case "boolean":
        right = newValue ? "1" : "0";
        break;
      case "number":
        right = `${newValue}`;
        break;
      case "object":
        if (newValue === null) {
          right = "0";
          break;
        }
        if (isObjectBinding(newValue)) {
          right = newValue.__meta__.name;
          break;
        }
      default:
        throw SyntaxError(`Unable to convert ${typeof newValue} to int`);
    }
    ctx.body.push(`${obj.__meta__.name} = ${typeName}${right}`);
    return;
  }
  throw new SyntaxError(
    `Cannot assign value because type ${getTypeName(
      newValue
    )} is incompatible with type ${getTypeName(obj)}`
  );
}

export function createBooleanBinding(name: string) {
  return createObjectBinding({ name, type: CType.Boolean });
}

export function createNumericBinding(
  name: string,
  value: number,
  type: CNumericType = CType.Int
) {
  return createObjectBinding({
    name,
    type: CType.Size,
    initializer: createNumericLiteral(value, type),
  });
}

function createFunctionContext(name: string): FunctionContext {
  return {
    kind: "FunctionContext",
    name,
    hasStateOperation: false,
    locals: [],
    body: [],
  };
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
  contextList.push(decl.context);
  handler();
  contextList.pop();
  return name;
}

function transformNode(node: ReactNode) {
  if (!isValidElement(node)) {
    return node;
  }
  return cloneElement(
    node,
    Object.keys(node.props).reduce((props, key) => {
      let value = node.props[key];
      if (key.startsWith("on")) {
        value = transformEventHandler(
          key.substring(2).toLocaleLowerCase(),
          value
        );
      }
      // TODO: 处理 ref
      // TODO: 处理 style 属性的数据绑定
      return { ...props, [key]: value };
    }, {})
  );
}

function compileFunction(
  ctx: FunctionContext,
  signature: string,
  body: string
) {
  return [
    signature,
    "{",
    ctx.locals.map((item) => `${compileVariableDeclaration(item)};`),
    body,
    ctx.locals.map((item) => `${compileObjectDestroyer(item.initializer)};`),
    "]",
  ].join("\n");
}

function compileComponentMethod(
  ctx: ComponentContext,
  name: string,
  args = "",
  body = ""
) {
  return compileFunction(
    ctx,
    `static void ${ctx.name}_${name}(ui_widget_t *w${args})`,
    [
      `${ctx.name}_t *_that = ui_widget_get_data(w, ${ctx.name}_proto);`,
      body,
      ctx.hasStateOperation && `${ctx.name}_update(w);`,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function compileComponentState(ctx: ComponentContext) {
  return [
    "typedef struct {",
    ...ctx.state.map(
      (item) => `${getObjectTypeName(item.initializer)} ${item.identifier};`
    ),
    `} ${ctx.name}_state_t;`,
    compileComponentMethod(
      ctx,
      "init_state",
      "",
      ctx.state
        .map(
          (item) =>
            `${item.initializer.__meta__.name} = ${compileObjectInitializer(
              item.initializer
            )}`
        )
        .filter((line) => line.length > 0)
        .join("\n")
    ),
    compileComponentMethod(
      ctx,
      "destroy_state",
      "",
      ctx.state
        .map((item) => compileObjectDestroyer(item.initializer))
        .filter((line) => line.length > 0)
        .join("\b")
    ),
  ].join("\n\n");
}
function compileComponentEventHandlers(ctx: ComponentContext) {
  return [
    ...ctx.eventHandlers.map((item) =>
      compileComponentMethod(
        ctx,
        item.handler.name,
        ", ui_event_t *e, void *arg",
        item.context.body.join(";\n")
      )
    ),
    compileComponentMethod(
      ctx,
      "init_event_handlers",
      "",
      ctx.eventHandlers
        .map(
          (item) => `ui_widget_on(w, "${item.eventName}", ${item.context.name})`
        )
        .join(";\n")
    ),
  ].join("\n\n");
}

function compileComponentMethods(ctx: ComponentContext) {
  return [
    `static void ${ctx.name}_init_base(ui_widget_t *w)`,
    "{",
    `${ctx.name}_init_state(w);`,
    `${ctx.name}_init_event_handlers(w);`,
    `${ctx.name}_update(w);`,
    "}\n",
    `static void ${ctx.name}_destroy_base(ui_widget_t *w)`,
    "{",
    `${ctx.name}_destroy_state(w);`,
    "}\n",
    compileComponentMethod(ctx, "update"),
  ].join("\n");
}

export function createComponent<T = {}>(componentFunc: React.FC<T>) {
  const newFunc = (props: T) => {
    const ctx: ComponentContext = {
      ...createFunctionContext(componentFunc.name),
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

    contextList = [ctx];
    const root = transformNode(componentFunc(props));
    compileComponentState(ctx);
    compileComponentEventHandlers(ctx);
    compileComponentMethods(ctx);
    // TODO: 生成 refs 结构体定义
    return root;
  };
  newFunc.name = componentFunc;
  return newFunc;
}
