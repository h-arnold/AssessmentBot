---
**Last Updated**: June 2, 2026
**Source**: https://ant.design/components/alert

---

# Alert

A lightweight prompt for feedback messages.

---

## When To Use

- When you need to show feedback messages to users, such as success, warning, error, or info messages.
- When you want to provide additional context or instructions.
- When you need to show a brief message that can be dismissed.

---

## Examples

### Basic Usage

```tsx
import { Alert } from 'antd';

<Alert message="Success Tips" type="success" showIcon />
<Alert message="Informational Notes" type="info" showIcon />
<Alert message="Warning" type="warning" showIcon />
<Alert message="Error" type="error" showIcon />
```

### Description

```tsx
import { Alert } from 'antd';

<Alert
  message="Success Tips"
  description="Detailed description and advice about successful copywriting."
  type="success"
  showIcon
/>;
```

### Banner Mode

```tsx
import { Alert } from 'antd';

<Alert message="Warning text" banner />;
```

---

## API

### Alert Props

| Property    | Description                           | Type                                        | Default |
| ----------- | ------------------------------------- | ------------------------------------------- | ------- |
| message     | The alert message                     | string                                      | -       |
| type        | Type of alert                         | `success` \| `info` \| `warning` \| `error` | `info`  |
| showIcon    | Whether to show the icon              | boolean                                     | false   |
| banner      | Whether to show as banner             | boolean                                     | false   |
| closable    | Whether to show close button          | boolean                                     | false   |
| closeText   | Custom close text                     | string \| ReactNode                         | -       |
| description | Additional description                | string \| ReactNode                         | -       |
| action      | Action buttons                        | ReactNode                                   | -       |
| onClose     | Callback when close button is clicked | () => void                                  | -       |

---

## Related Components

- [Message](https://ant.design/components/message) - Global feedback messages
- [Notification](https://ant.design/components/notification) - Global notification messages
- [Popover](https://ant.design/components/popover) - Contextual information
