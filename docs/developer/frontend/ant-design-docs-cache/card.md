---
**Last Updated**: June 2, 2026
**Source**: https://ant.design/components/card

---

# Card

A container for displaying content and actions.

---

## When To Use

- For displaying complex information in a structured way
- To group related content and actions
- For creating dashboard cards or product cards
- When you need a header, content, and footer structure

---

## Examples

### Basic Card

```tsx
import { Card } from 'antd';

<Card title="Default Card" bordered={false}>
  <p>Card content</p>
</Card>;
```

### Card with Actions

```tsx
import { Card } from 'antd';

<Card title="Card Title" extra={<a href="#">More</a>} style={{ width: 300 }}>
  <p>Card content</p>
</Card>;
```

### Grid Cards

```tsx
import { Card } from 'antd';

<Card title="Card Title">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
    <Card>Card 1</Card>
    <Card>Card 2</Card>
    <Card>Card 3</Card>
  </div>
</Card>;
```

### Card Types

```tsx
import { Card } from 'antd';

<Card title="Default" style={{ width: 300, marginBottom: 16 }}>
  <p>Default Card</p>
</Card>

<Card title="Inner" type="inner" style={{ width: 300 }}>
  <p>Inner Card</p>
</Card>
```

---

## API

### Card Props

| Property  | Description                | Type                 | Default   |
| --------- | -------------------------- | -------------------- | --------- |
| title     | Card title                 | string \| ReactNode  | -         |
| bordered  | Whether to show border     | boolean              | true      |
| type      | Card type                  | `default` \| `inner` | `default` |
| size      | Card size                  | `default` \| `small` | `default` |
| extra     | Extra content at top right | string \| ReactNode  | -         |
| bodyStyle | Style for card content     | CSSProperties        | -         |
| headStyle | Style for card header      | CSSProperties        | -         |
| actions   | Card actions               | Array<ReactNode>     | -         |

### Card.Meta Props

| Property    | Description      | Type                | Default |
| ----------- | ---------------- | ------------------- | ------- |
| avatar      | Avatar image     | ReactNode           | -       |
| title       | Meta title       | string \| ReactNode | -       |
| description | Meta description | string \| ReactNode | -       |

---

## Related Components

- [Grid](https://ant.design/components/grid) - Card layout
- [Typography](https://ant.design/components/typography) - Card text styling
- [Avatar](https://ant.design/components/avatar) - Card avatar images
