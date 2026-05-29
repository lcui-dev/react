import React from "react";

interface WidgetBaseAttributes {
  $ref?: string | { name: string; current: any };
  className?: string;
  children?: any;
  [x: string]: any;
}

interface WidgetAttributes extends WidgetBaseAttributes {
  type?: string;
}

interface LinkAttributes extends WidgetBaseAttributes {
  href?: string;
}

interface TextInputAttributes extends WidgetBaseAttributes {
  placeholder?: string;
}

interface ScrollbarAttributes extends WidgetBaseAttributes {
  orientation?: "horizontal" | "vertical";
}

interface RouterLinkAttributes extends WidgetBaseAttributes {
  to: string;
  exact?: "exact" | "";
  "exact-active-class"?: string;
  "active-class"?: string;
}

interface RouterViewAttributes extends WidgetBaseAttributes {
  /** @see https://router.vuejs.org/zh/guide/essentials/named-views.html */
  name?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      widget: WidgetAttributes;
      textinput: TextInputAttributes;
      scrollbar: ScrollbarAttributes;
      scrollarea: WidgetBaseAttributes;
      "scrollarea-content": WidgetBaseAttributes;
      "router-link": RouterLinkAttributes;
      "router-view": RouterViewAttributes;
    }
  }
}

export type WidgetProps = WidgetAttributes;
export type WidgetBaseProps = WidgetBaseAttributes;
export type LinkProps = LinkAttributes;
export type RouterViewProps = RouterViewAttributes;
export type ScrollbarProps = ScrollbarAttributes;

export type FunctionWidget<T = WidgetBaseProps> = ((props: T) => React.ReactElement) & {
  shouldPreRender?: boolean;
};

export interface RouterLinkProps extends WidgetBaseProps {
  to: string;
  exact?: boolean;
  exactActiveClass?: string;
  activeClass?: string;
}

export interface TextInputProps extends WidgetBaseProps {
  placeholder?: string;
}

function withWidgetMeta<T extends WidgetBaseProps>(
  render: (props: T) => React.ReactElement
): FunctionWidget<T> {
  const widget = ((props: T) => render(props)) as FunctionWidget<T>;
  widget.shouldPreRender = true;
  return widget;
}

function createTagWidget<T extends WidgetBaseProps>(tag: string): FunctionWidget<T> {
  return withWidgetMeta((props: T) => React.createElement(tag, props));
}

export const Text: FunctionWidget<WidgetBaseProps> = createTagWidget("text");
export const TextInput: FunctionWidget<TextInputProps> =
  createTagWidget("textinput");
export const Link: FunctionWidget<LinkProps> = createTagWidget("a");
export const Button: FunctionWidget<WidgetBaseProps> = createTagWidget("button");
export const Widget: FunctionWidget<WidgetProps> = createTagWidget("widget");
export const Scrollbar: FunctionWidget<ScrollbarProps> =
  createTagWidget("scrollbar");
export const ScrollArea: FunctionWidget<WidgetBaseProps> =
  createTagWidget("scrollarea");
export const ScrollAreaContent: FunctionWidget<WidgetBaseProps> =
  createTagWidget("scrollarea-content");

export const RouterLink: FunctionWidget<RouterLinkProps> = withWidgetMeta(({
  exact,
  to,
  activeClass = "",
  exactActiveClass = "",
  ...otherProps
}: RouterLinkProps) => {
  const props = {
    to,
    "active-class": activeClass,
    exact: exact ? "exact" : "",
    "exact-active-class": exactActiveClass,
    ...otherProps,
  } as const;
  return <router-link {...props} />;
});

export const RouterView: FunctionWidget<RouterViewProps> =
  createTagWidget("router-view");
