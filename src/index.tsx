/// <reference path="../types.d.ts" />

import React, { createElement, Fragment } from "react";

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
