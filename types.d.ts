declare namespace JSX {
  interface IntrinsicElements {
    a: LinkProps;
    text: WidgetBaseProps;
    textinput: TextInputProps;
    widget: WidgetProps;
    div: WidgetProps;
  }
}

// The following content is copied from: https://github.com/vitejs/vite/blob/main/packages/vite/client.d.ts

// CSS modules
type CSSModuleClasses = { readonly [key: string]: string };

declare module "*.module.css" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.scss" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.sass" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.less" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.styl" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.stylus" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.pcss" {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module "*.module.sss" {
  const classes: CSSModuleClasses;
  export default classes;
}

// CSS
declare module "*.css" {}
declare module "*.scss" {}
declare module "*.sass" {}
declare module "*.less" {}
declare module "*.styl" {}
declare module "*.stylus" {}
declare module "*.pcss" {}
declare module "*.sss" {}

// images
declare module "*.apng" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.jfif" {
  const src: string;
  export default src;
}
declare module "*.pjpeg" {
  const src: string;
  export default src;
}
declare module "*.pjp" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.ico" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.avif" {
  const src: string;
  export default src;
}

// fonts
declare module "*.woff" {
  const src: string;
  export default src;
}
declare module "*.woff2" {
  const src: string;
  export default src;
}
declare module "*.eot" {
  const src: string;
  export default src;
}
declare module "*.ttf" {
  const src: string;
  export default src;
}
declare module "*.otf" {
  const src: string;
  export default src;
}
