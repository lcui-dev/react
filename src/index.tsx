/// <reference path="../types.d.ts" />

import React, { createElement, Fragment } from "react";

export * from './binding.js';
export { default as fmt } from "./fmt.js";
export { default as useState } from "./useState.js";
export { default as compile } from "./compile.js";

export interface WidgetBaseProps {
  $ref?: string;
  className?: string;
  children?: any;
  [x: string]: any;
}

export interface WidgetProps extends WidgetBaseProps {
  type?: string;
}

export { createElement, Fragment };

export interface LinkProps extends WidgetBaseProps {
  href?: string;
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

Widget.shouldPreRender = true;
Button.shouldPreRender = true;
Link.shouldPreRender = true;
Text.shouldPreRender = true;
TextInput.shouldPreRender = true;

export default React;
