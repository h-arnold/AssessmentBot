---
**Last Updated**: June 2, 2026
**Source**: https://ant.design/components/skeleton

---

# Skeleton

A placeholder for content that is loading.

---

## When To Use

- When content is being loaded asynchronously
- To provide a better user experience during data fetching
- For creating placeholder layouts that match the structure of the content being loaded
- Perfect for showing loading states in the Classes page while data is being fetched

---

## Examples

### Basic Skeleton

```tsx
import { Skeleton } from 'antd';

<Skeleton />;
```

### Skeleton with Avatar

```tsx
import { Skeleton, Avatar } from 'antd';

<Skeleton avatar paragraph={{ rows: 4 }} />;
```

### Skeleton with Title and Paragraph

```tsx
import { Skeleton } from 'antd';

<Skeleton title={false} active />
<Skeleton title={false} paragraph={{ rows: 4 }} />
```

### Active Skeleton

```tsx
import { Skeleton } from 'antd';

<Skeleton active />;
```

### Skeleton with Component

```tsx
import { Skeleton, Card } from 'antd';

<Card>
  <Skeleton loading={loading} avatar paragraph={{ rows: 4 }} active />
</Card>;
```

### Skeleton with List

```tsx
import { Skeleton, List } from 'antd';

<List
  dataSource={[]}
  renderItem={() => (
    <List.Item>
      <Skeleton title={false} paragraph={{ rows: 2 }} active />
    </List.Item>
  )}
/>;
```

---

## API

### Skeleton Props

| Property  | Description               | Type                                             | Default |
| --------- | ------------------------- | ------------------------------------------------ | ------- |
| active    | Whether to show animation | boolean                                          | false   |
| avatar    | Avatar configuration      | boolean \| { shape?: 'circle' \| 'square' }      | false   |
| title     | Title configuration       | boolean \| { width?: number \| string }          | true    |
| paragraph | Paragraph configuration   | boolean \| { rows?: number, width?: number\[\] } | true    |
| loading   | Whether skeleton is shown | boolean                                          | true    |
| rowKey    | Row key for list skeleton | string \| number                                 | 'key'   |

---

## Related Components

- [Spin](https://ant.design/components/spin) - Loading spinner
- [Card](https://ant.design/components/card) - Skeleton for card layouts
- [List](https://ant.design/components/list) - Skeleton for list items
