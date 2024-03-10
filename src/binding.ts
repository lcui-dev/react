import React, { ReactNode, cloneElement, isValidElement } from "react";

type Value = string | number | boolean | object | null | ObjectBinding;

enum SyntaxKind {
  Unknown,
  StringLiteral,
  NumericLiteral,
  CallExpression,
  NewExpression,
}

enum CType {
  Unknown,
  Int,
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
  initializer?: InitializerExpression;
}

interface FunctionContext {
  kind: string;
  locals: VariableDeclaration[];
  body: string[];
}

interface EventHandlerDeclaration {
  eventName: string;
  name: string;
  context: FunctionContext;
}

interface ComponentContext extends FunctionContext {
  kind: "ComponentContext";
  name: string;
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

type Binding<T = BindingMeta> = BindingBase<T> & { [key: string]: Binding };
type ObjectBinding = Binding<ObjectBindingMeta>;

interface CPrototype {
  create(...args: Value[]);
  duplicate(obj: ObjectBinding): VariableDeclaration;
  toString(obj: ObjectBinding): VariableDeclaration;
  destroy(obj: ObjectBinding): void;
}

const typeNameMap = {
  [CType.Double]: "double",
  [CType.Size]: "size_t",
  [CType.Int]: "int",
  [CType.String]: "char*",
};

function getObjectTypeName(obj: ObjectBinding) {
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

function getTypeName(value: Value) {
  if (isObjectBinding(value)) {
    return getObjectTypeName(value);
  }
  return typeof value;
}

function toClassName(typeName: string) {
  return typeName.endsWith("_t")
    ? typeName.substring(0, typeName.length - 1)
    : typeName;
}

function getInitializerName(typeName: string) {
  return `${toClassName(typeName)}_create`;
}

function getDestroyerName(typeName: string) {
  return `${toClassName(typeName)}_destroy`;
}

function resolveBindingIdentify(b: ObjectBinding) {
  // TODO: 考虑 b.owner 存在的情况
  return b.__meta__.name || "unnamed_obj";
}

function createCallExpression(identifier: string, args: Value[]) {
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

function createStringBinding(value: string | null = null) {
  const ctx = getFunctionContext();
  const identifier = `str_${ctx.locals.length}`;
  const binding = createObjectBinding({
    name: identifier,
    type: CType.String,
    initializer: createStringLiteral(value),
  });

  ctx.locals.push({
    identifier,
    initializer: binding,
  });
  return binding;
}

function createTypedObjectBinding(typeName: string, args: Value[] = []) {
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
  ctx.body.push(
    `${identifier} = ${createCallExpression(
      getInitializerName(typeName),
      args
    )}`
  );
  return binding;
}

function destroyObjectBinding(obj: ObjectBinding) {
  const ctx = getFunctionContext();
  const init = obj.__meta__.initializer;

  if (!init) {
    throw new SyntaxError("missing initializer");
  }
  switch (init.kind) {
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.StringLiteral:
      break;
    case SyntaxKind.NewExpression:
      ctx.body.push(`${getDestroyerName(init.identifier)}(${obj.name})`);
      break;
    default:
      break;
  }
}

let contextList: FunctionContext[] = [];

function getFunctionContext() {
  if (contextList.length < 2) {
    throw new SyntaxError("FunctionContext is missing");
  }
  return contextList[contextList.length - 1];
}

function getComponentContext() {
  if (contextList[0]?.kind !== "ComponentContext") {
    throw new SyntaxError(
      "The createState function must be called in a component function"
    );
  }
  return contextList[0] as ComponentContext;
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
        return createTypedObjectBinding(meta.name, args);
      },
      apply(target: Binding, _thisArg, args) {
        if (target.__meta__.kind === BindingKind.Module) {
          throw new SyntaxError("Module cannot be used as a function");
        }
        const ctx = getFunctionContext();
        ctx.body.push(
          createCallExpression(
            resolveBindingIdentify(target as ObjectBinding),
            args
          )
        );
      },
    }
  ) as Binding;
  return binding;
}

function createObjectBinding(meta: Omit<ObjectBindingMeta, "kind">) {
  return createBinding({ ...meta, kind: BindingKind.Object }) as ObjectBinding;
}

function isObjectBinding(val: any): val is ObjectBinding {
  return typeof val === "object" && "__meta__" in val;
}

function stringifyBinding(obj: ObjectBinding) {
  const ctx = getFunctionContext();
  switch (obj.__meta__.type) {
    case CType.String:
      return obj;
    case CType.Object: {
      const typeName = getObjectTypeName(obj);
      const str = createStringBinding();
      ctx.body.push(
        `${str.__meta__.name} = ${toClassName(typeName)}_to_string(${
          obj.__meta__.name
        })`
      );
    }
    case CType.Double: {
      const str = createStringBinding();
      ctx.body.push(
        `${str.__meta__.name} = malloc(sizeof(char) * 32)`,
        `snprintf(${str.__meta__.name}, 31, "%lf", ${obj.__meta__.name})`,
        `${str.__meta__.name}[31] = 0`
      );
      return str;
    }
    case CType.Int: {
      const str = createStringBinding();
      ctx.body.push(
        `${str.__meta__.name} = malloc(sizeof(char) * 32)`,
        `snprintf(${str.__meta__.name}, 31, "%d", ${obj.__meta__.name})`,
        `${str.__meta__.name}[31] = 0`
      );
      return str;
    }
    case CType.Size: {
      const str = createStringBinding();
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

function stringifyValue(value: Value) {
  switch (typeof value) {
    case "string":
      return createStringBinding(value);
    case "boolean":
    case "number":
      return createStringBinding(`${value}`);
    case "undefined":
      return createStringBinding("undefined");
    case "object":
      if (value === null) {
        return createStringBinding();
      }
      if (isObjectBinding(value)) {
        return stringifyBinding(value);
      }
    default:
      break;
  }
  throw SyntaxError(`Unable to convert ${typeof value} to a string`);
}

function isNumericType(t: CType): t is CNumericType {
  return cNumericTypes.includes(t as CNumericType);
}

function setObjectBindingValue(obj: ObjectBinding, newValue: Value) {
  const ctx = getFunctionContext();
  if (obj.__meta__.type === CType.String) {
    const str = stringifyValue(newValue);
    destroyObjectBinding(obj);
    ctx.body.push(`${obj.__meta__.name} = ${str.__meta__.name}`);
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

export function fmt(...args: Value[]) {
  const ctx = getFunctionContext();
  const str = createStringBinding();
  const len = createObjectBinding({
    name: `${str.__meta__.name}_len`,
    type: CType.Size,
    initializer: createNumericLiteral(8, CType.Size),
  });
  const list = args.map((value) => stringifyValue(value));

  ctx.locals.push({
    identifier: len.__meta__.name,
    initializer: len,
  });
  ctx.body.push(...list.map((id) => `${len.__meta__.name} += strlen(${id})`));
  ctx.body.push(
    `${str.__meta__.name} = malloc(sizeof(char) * ${len.__meta__.name})`
  );
  ctx.body.push(
    ...list.map(
      (id, index) =>
        `${index === 0 ? `strcpy` : `strcat`}(${str.__meta__.name}, ${id})`
    )
  );
  return str;
}

export function useState(initialValue: Value) {
  let value: ObjectBinding;
  const ctx = getComponentContext();
  const stateName =
    ctx.stateNames[ctx.state.length] || `unnamed_state_${ctx.state.length}`;
  const stateCName = `_that->${stateName}`;
  const typeName = typeNameMap[typeof initialValue];

  if (isObjectBinding(initialValue)) {
    value = initialValue;
    ctx.locals = ctx.locals.filter(
      (local) => local.initializer !== initialValue
    );
    ctx.body = ctx.body.filter((line) => !line.startsWith(value.__meta__.name));
    value.__meta__.name = stateCName;
  } else if (typeName) {
    value = createObjectBinding({ name: stateCName, type: typeName });
  } else {
    throw new SyntaxError(`Unsupported type: ${typeName}`);
  }
  ctx.state.push({ identifier: stateName, initializer: value });
  return [
    value,
    (newValue: Value) => setObjectBindingValue(value, newValue),
  ] as const;
}

function createFunctionContext(): FunctionContext {
  return {
    kind: "FunctionContext",
    locals: [],
    body: [],
  };
}

function createEventHandler(eventName: string, func: Function) {
  const ctx = getComponentContext();
  const handler: EventHandlerDeclaration = {
    name: `${ctx.name}_${
      func.name || `${eventName}_handler_${ctx.eventHandlers.length}`
    }`,
    eventName,
    context: createFunctionContext(),
  };
  // TODO: 生成事件处理代码
  ctx.eventHandlers.push(handler);
  contextList.push(handler.context);
  func();
  contextList.pop();
  return;
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
        value = createEventHandler(key.substring(2).toLocaleLowerCase(), value);
      }
      // TODO: 处理 ref
      // TODO: 处理 style 属性的数据绑定
      return { ...props, [key]: value };
    }, {})
  );
}

export function createComponent<T = {}>(componentFunc: React.FC<T>) {
  return (props: T) => {
    const ctx: ComponentContext = {
      ...createFunctionContext(),
      name: componentFunc.name,
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
    return transformNode(componentFunc(props));
  };
}
