---
**Last Updated**: June 2, 2026
**Source**: https://ant.design/components/button

---

# Button

A button component for user actions.

---

## When To Use

- When you need a clickable element that triggers an action
- For form submissions, dialog triggers, or any interactive element
- When you need different button styles (primary, default, text, etc.)

---

## Examples

### Basic Usage

```tsx
import { Button } from 'antd';

<Button type="primary">Primary Button</Button>
<Button>Default Button</Button>
<Button type="dashed">Dashed Button</Button>
<Button type="text">Text Button</Button>
<Button type="link">Link Button</Button>
```

### Size

```tsx
import { Button } from 'antd';

<Button size="large">Large Button</Button>
<Button>Middle Button</Button>
<Button size="small">Small Button</Button>
```

### Icon Button

```tsx
import { Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

<Button type="primary" icon={<SearchOutlined />} />
<Button icon={<SearchOutlined />}>Search</Button>
```

### Disabled State

```tsx
import { Button } from 'antd';

<Button type="primary" disabled>Disabled Primary</Button>
<Button disabled>Disabled Default</Button>
```

---

## API

### Button Props

| Property | Description                        | Type                                                   | Default   |
| -------- | ---------------------------------- | ------------------------------------------------------ | --------- |
| type     | Button type                        | `primary` \| `default` \| `dashed` \| `text` \| `link` | `default` |
| size     | Button size                        | `large` \| `middle` \| `small`                         | `middle`  |
| shape    | Button shape                       | `circle` \| `round`                                    | -         |
| icon     | Button icon                        | ReactNode                                              | -         |
| disabled | Disable the button                 | boolean                                                | false     |
| ghost    | Make button background transparent | boolean                                                | false     |
| block    | Full width button                  | boolean                                                | false     |
| danger   | Red button for dangerous actions   | boolean                                                | false     |
| loading  | Show loading state                 | boolean \| { delay: number }                           | false     |
| onClick  | Click handler                      | (event) => void                                        | -         |

---

## Related Components

- [Icon](https://ant.design/components/icon) - Button icons
- [Typography](https://ant.design/components/typography) - Button text styling
- [Space](https://ant.design/components/space) - Button spacing
