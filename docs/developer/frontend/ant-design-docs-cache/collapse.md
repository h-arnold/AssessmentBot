---
**Last Updated**: June 2, 2026
**Source**: https://ant.design/components/collapse

---

# Collapse

A content area which can be collapsed and expanded.

---

## When To Use

- Can be used to group or hide complex regions to keep the page clean.
- `Accordion` is a special kind of `Collapse`, which allows only one panel to be expanded at a time.
- Ideal for organizing content into expandable sections (perfect for Classes page year-group organization)

---

## Examples

### Basic Collapse

By default, any number of panels can be expanded at a time. The first panel is expanded in this example.

```tsx
import React from 'react';
import type { CollapseProps } from 'antd';
import { Collapse } from 'antd';

const text = `
  A dog is a type of domesticated animal.
  Known for its loyalty and faithfulness,
  it can be found as a welcome guest in many households across the world.
`;

const items: CollapseProps['items'] = [
  {
    key: '1',
    label: 'This is panel header 1',
    children: <p>{text}</p>,
  },
  {
    key: '2',
    label: 'This is panel header 2',
    children: <p>{text}</p>,
  },
  {
    key: '3',
    label: 'This is panel header 3',
    children: <p>{text}</p>,
  },
];

const App: React.FC = () => {
  const onChange = (key: string | string[]) => {
    console.log(key);
  };

  return <Collapse items={items} defaultActiveKey={['1']} onChange={onChange} />;
};

export default App;
```

### Controlled State

```tsx
import React, { useState } from 'react';
import { Collapse, Button } from 'antd';

const App: React.FC = () => {
  const [activeKey, setActiveKey] = useState(['1']);

  const toggle = () => {
    setActiveKey(activeKey.length === 0 ? ['1'] : []);
  };

  return (
    <>
      <Button onClick={toggle}>Toggle Collapse</Button>
      <Collapse
        items={[{ key: '1', label: 'Panel', children: <p>Content</p> }]}
        activeKey={activeKey}
      />
    </>
  );
};
```

### Size Variants

Ant Design supports a default collapse size as well as a large and small size.

```tsx
import React from 'react';
import { Collapse, Divider } from 'antd';

const text = `
  A dog is a type of domesticated animal.
  Known for its loyalty and faithfulness,
  it can be found as a welcome guest in many households across the world.
`;

const App: React.FC = () => (
  <>
    <Divider titlePlacement="start">Medium Size</Divider>
    <Collapse
      items={[{ key: '1', label: 'This is medium size panel header', children: <p>{text}</p> }]}
    />
    <Divider titlePlacement="start">Small Size</Divider>
    <Collapse
      size="small"
      items={[{ key: '1', label: 'This is small size panel header', children: <p>{text}</p> }]}
    />
    <Divider titlePlacement="start">Large Size</Divider>
    <Collapse
      size="large"
      items={[{ key: '1', label: 'This is large size panel header', children: <p>{text}</p> }]}
    />
  </>
);
```

### Custom Expand Icon

```tsx
import React from 'react';
import { Collapse, DownOutlined } from 'antd';

const App: React.FC = () => (
  <Collapse
    items={[
      {
        key: '1',
        label: 'Custom Icon',
        children: <p>Content with custom expand icon</p>,
        expandIcon: () => <DownOutlined />,
      },
    ]}
  />
);
```

---

## API

### Collapse Props

| Property         | Description                                 | Type                                                                                                                     | Default  |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| items            | Collapse items configuration                | Array<{key: string, label: ReactNode, children: ReactNode, disabled?: boolean, showArrow?: boolean, extra?: ReactNode }> | -        |
| activeKey        | Current active panel keys                   | string\[\]                                                                                                               | -        |
| defaultActiveKey | Default active panel keys                   | string\[\]                                                                                                               | -        |
| bordered         | Whether to show border                      | boolean                                                                                                                  | true     |
| collapsible      | Collapsible behavior                        | `header` \| `icon` \| `disabled`                                                                                         | `header` |
| expandIcon       | Custom expand icon                          | (props) => ReactNode                                                                                                     | -        |
| ghost            | Make background transparent                 | boolean                                                                                                                  | false    |
| size             | Collapse size                               | `small` \| `middle` \| `large`                                                                                           | `middle` |
| onChange         | Callback when panels are expanded/collapsed | (key: string\[\]) => void                                                                                                | -        |

### Collapse Item Props

| Property  | Description                     | Type      | Default |
| --------- | ------------------------------- | --------- | ------- |
| key       | Unique identifier for the panel | string    | -       |
| label     | Panel header content            | ReactNode | -       |
| children  | Panel content                   | ReactNode | -       |
| disabled  | Whether panel is disabled       | boolean   | false   |
| showArrow | Whether to show expand arrow    | boolean   | true    |
| extra     | Extra content in panel header   | ReactNode | -       |

---

## Related Components

- [Icon](https://ant.design/components/icon) - Expand/collapse icons
- [Typography](https://ant.design/components/typography) - Panel header text
- [Space](https://ant.design/components/space) - Panel spacing
