# @lcui/react

(**中文**/[English](README.md))

一个用于 LCUI 应用程序开发的 React 库，提供 TypeScript 类型声明、React 版预置组件，配合 [@lcui/cli](https://gitee.com/lcui-dev/lcui-cli) 使用。

## 安装

```sh
npm install -D @lcui/react react @types/react
```

## 使用

```tsx
import { Text, TextInput } from '@lcui/react';
import styles from './app.module.css';

export default function App() {
  return (
    <div className={styles.app}>
      <Text>Hello, World!</Text>
      <TextInput placeholder="Please input..." />
    <div>
  );
}
```

LCUI 并不是浏览器引擎，像文字展示和输入功能需要由特定的组件实现，因此，在 JSX 写法上会有如下差异：

```diff
  <div className={styles.app}>
-   Hello, World!
+   <Text>Hello, World!</Text>
-   <input placeholder="Please input..." />
+   <TextInput placeholder="Please input..." />
  <div>
```

## 许可

[MIT](./LICENSE)
