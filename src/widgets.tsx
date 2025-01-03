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

export interface RouterLinkProps extends WidgetBaseProps {
  to: string;
  exact?: boolean;
  exactActiveClass?: string;
  activeClass?: string;
}

export interface TextInputProps extends WidgetBaseProps {
  placeholder?: string;
}

export function Text(props: WidgetBaseProps) {
  return <text {...props} />;
}

export function TextInput(props: TextInputProps) {
  return <textinput {...props} />;
}

export function Link(props: LinkProps) {
  return <a {...props} />;
}

export function Button(props: WidgetBaseProps) {
  return <button {...props} />;
}

export function Widget(props: WidgetProps) {
  return <widget {...props} />;
}

export function Scrollbar(props: ScrollbarProps) {
  return <scrollbar {...props} />;
}

export function ScrollArea(props: WidgetBaseProps) {
  return <scrollarea {...props} />;
}

export function ScrollAreaContent(props: WidgetBaseProps) {
  return <scrollarea-content {...props} />;
}

export function RouterLink({
  exact,
  to,
  activeClass = "",
  exactActiveClass = "",
  ...otherProps
}: RouterLinkProps) {
  const props = {
    to,
    "active-class": activeClass,
    exact: exact ? "exact" : "",
    "exact-active-class": exactActiveClass,
    ...otherProps,
  } as const;
  return <router-link {...props} />;
}

export function RouterView(props: RouterViewProps) {
  return <router-view {...props} />;
}

Widget.shouldPreRender = true;
Button.shouldPreRender = true;
Link.shouldPreRender = true;
Text.shouldPreRender = true;
TextInput.shouldPreRender = true;
ScrollArea.shouldPreRender = true;
ScrollAreaContent.shouldPreRender = true;
Scrollbar.shouldPreRender = true;
RouterLink.shouldPreRender = true;
RouterView.shouldPreRender = true;
