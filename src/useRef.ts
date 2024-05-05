import {
  CType,
  factory,
  getComponentContext,
  getFunctionContext,
  stringifyValue,
} from "./binding.js";

class WidgetInstance {
  ident: string;
  type: string = "unknown";

  constructor(ident: string) {
    this.ident = ident;
  }

  getTextInputValue() {
    const ctx = getFunctionContext();
    const str = factory.createStringVariable();
    const len = factory.createNumericVariable(
      `${str.__meta__.name}_len`,
      0,
      CType.Size
    );
    const wcsIdent = `${str.__meta__.name}_wcs`;
    const wcsLenIdent = `${wcsIdent}_len`;
    ctx.body.push(
      `size_t ${wcsLenIdent} = ui_textinput_get_text_length(${this.ident})`,
      `wchar_t *${wcsIdent} = malloc(sizeof(wchar_t) * (${wcsLenIdent} + 4))`,
      `ui_textinput_get_text_w(${this.ident}, 0, ${wcsLenIdent} + 1, ${wcsIdent})`,
      `${len.__meta__.name} = wcstombs(NULL, ${wcsIdent}, 0) + 1`,
      `${str.__meta__.name} = malloc(sizeof(char) * ${len.__meta__.name})`,
      `wcstombs(${str.__meta__.name}, ${wcsIdent}, ${len.__meta__.name})`
    );
    str.__meta__.keepAlive = true;
    return str;
  }

  setTextInputValue(value: string) {
    const ctx = getFunctionContext();
    const str = stringifyValue(value);
    ctx.body.push(`ui_textinput_set_text(${this.ident}, ${str.__meta__.name}`);
  }

  get value() {
    switch (this.type) {
      case "textinput":
        return this.getTextInputValue();
      default:
        break;
    }
    throw SyntaxError(`Unable to get value of ${this.type} type component`);
  }

  set value(newValue: any) {
    switch (this.type) {
      case "textinput":
        this.setTextInputValue(newValue);
        return;
      default:
        break;
    }
    throw SyntaxError(`Unable to set value of ${this.type} type component`);
  }
}

export default function useRef() {
  const ctx = getComponentContext();
  const name = ctx.refNames[ctx.refs.length] || `ref_${ctx.refs.length}`;
  const cName = `_that->refs.${name}`;

  ctx.refs.push(name);
  ctx.headerFiles.add('<stdlib.h>');
  ctx.headerFiles.add('<ui_widgets.h>');
  return factory.createObjectBinding(
    {
      name: cName,
      type: CType.Object,
    },
    { name, current: new WidgetInstance(cName) }
  ) as unknown as {
    name: string;
    current: WidgetInstance;
  };
}
