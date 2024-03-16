import {
  CType,
  Value,
  createNumericBinding,
  createStringVariable,
  getFunctionContext,
  stringifyValue,
} from "./binding";

export default function fmt(...args: Value[]) {
  const ctx = getFunctionContext();
  const str = createStringVariable();
  const len = createNumericBinding(`${str.__meta__.name}_len`, 8, CType.Size);
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
