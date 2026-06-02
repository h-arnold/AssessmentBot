---
**Last Updated**: June 2, 206
**Source**: https://ant.design/components/spin

---

# Spin

A loading spinner for indicating async operations.

---

## When To Use

- When an operation is in progress and the user needs to wait
- To indicate that content is being loaded or processed
- For showing loading states during data fetching or API calls
- Perfect for indicating busy states in the Classes page during refresh operations

---

## Examples

### Basic Spin

```tsx
import { Spin } from 'antd';

<Spin />;
```

### Spin with Tip

```tsx
import { Spin } from 'antd';

<Spin tip="Loading..." />;
```

### Delayed Spin

```tsx
import { Spin } from 'antd';

<Spin spinning={isLoading} delay={500} />;
```

### Custom Indicator

```tsx
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

<Spin indicator={antIcon} />;
```

### Spin with Nested Content

```tsx
import { Spin, Alert } from 'antd';

<Spin tip="Loading...">
  <Alert
    message="Alert message title"
    description="Further details about the context of this alert."
    type="info"
  />
</Spin>;
```

### Fullscreen Spin

```tsx
import { Spin } from 'antd';

<div style={{ position: 'relative' }}>
  <Spin fullscreen />
</div>;
```

---

## API

### Spin Props

| Property         | Description                       | Type                            | Default   |
| ---------------- | --------------------------------- | ------------------------------- | --------- |
| spinning         | Whether to show spinner           | boolean                         | true      |
| size             | Spinner size                      | `small` \| `default` \| `large` | `default` |
| tip              | Loading tip text                  | string                          | -         |
| delay            | Delay before showing spinner (ms) | number                          | 0         |
| indicator        | Custom spinner indicator          | ReactNode                       | -         |
| wrapperClassName | Wrapper class name                | string                          | -         |
| fullscreen       | Fullscreen mode                   | boolean                         | false     |

### Spin Methods

| Method | Description    |
| ------ | -------------- |
| spin() | Start spinning |
| stop() | Stop spinning  |

---

## Related Components

- [Skeleton](https://ant.design/components/skeleton) - Loading skeleton
- [Alert](https://ant.design/components/alert) - Loading messages
- [Typography](https://ant.design/components/typography) - Loading text
