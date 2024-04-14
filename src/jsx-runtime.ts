import React from "react";
import * as rt from "react/jsx-runtime";
import { ObjectBinding, isObjectBinding } from "./binding.js";

type JSXFactor = (
  type: React.ElementType,
  props: Record<string, any>
) => React.ReactElement;

declare module "react/jsx-runtime" {
  export const jsx: JSXFactor;
  export const jsxs: JSXFactor;
}

export function JSXObjectBinding({ value }: { value: ObjectBinding }) {
  return `[JSXObjectBinding ${value.__meta__.name}]`;
}

function transformReactChild(child: any) {
  if (child && isObjectBinding(child)) {
    return React.createElement(JSXObjectBinding, { value: child });
  }
  return child;
}

function transformElementProps(props: Record<string, any>) {
  if (props && props.children) {
    return {
      ...props,
      children: Array.isArray(props.children)
        ? props.children.map(transformReactChild)
        : transformReactChild(props.children),
    };
  }
  return props;
}

export const jsx: JSXFactor = (type, props) =>
  rt.jsx(type, transformElementProps(props));

export const jsxs: JSXFactor = (type, props) =>
  rt.jsxs(type, transformElementProps(props));
