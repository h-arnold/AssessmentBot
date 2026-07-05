---
**Last Updated**: June 4, 2026
**Source**: https://ant.design/components/tag.md
---

Source: https://ant.design/components/tag.md

---

category: Components
group: General
title: Tag
ialert.description: Used for marking and categorization.

alert.details: Used for marking and categorization.

alert.kind: risk

---

## When To Use

- It can be used to tag by dimension or property.
- When categorizing.
- When highlighting important information.
- When displaying status or state.

## Examples

### Basic

Basic usage.

```tsx
import React from 'react';
import { Tag } from 'antd';

const App: React.FC = () => (
  <>
    <Tag>Default</Tag>
    <Tag color="blue">Blue</Tag>
    <Tag color="green">Green</Tag>
    <Tag color="orange">Orange</Tag>
    <Tag color="red">Red</Tag>
    <Tag color="purple">Purple</Tag>
    <Tag color="cyan">Cyan</Tag>
    <Tag color="gold">Gold</Tag>
  </>
);

export default App;
```

### Variants

Different variant styles.

```tsx
import React from 'react';
import { Tag } from 'antd';

const App: React.FC = () => (
  <>
    <Tag variant="filled">Filled</Tag>
    <Tag variant="solid">Solid</Tag>
    <Tag variant="outlined">Outlined</Tag>
  </>
);

export default App;
```

### Color

Set color with color prop.

```tsx
import React from 'react';
import { Tag } from 'antd';

const colors = ['default', 'blue', 'green', 'orange', 'red', 'purple', 'cyan', 'gold'];

const App: React.FC = () => (
  <div>
    {colors.map((color) => (
      <Tag key={color} color={color}>
        {color}
      </Tag>
    ))}
  </div>
);

export default App;
```

### With Icon

Add icon to tag.

```tsx
import React from 'react';
import { SmileOutlined } from '@ant-design/icons';
import { Tag } from 'antd';

const App: React.FC = () => (
  <>
    <Tag icon={<SmileOutlined />}>With Icon</Tag>
    <Tag color="blue" icon={<SmileOutlined />}>
      Blue Tag
    </Tag>
    <Tag color="green" variant="outlined">
      Green Tag
    </Tag>
  </>
);

export default App;
```

### Checkable

Checkable tag for selecting.

```tsx
import React, { useState } from 'react';
import { Tag } from 'antd';

const App: React.FC = () => {
  const [selected, setSelected] = useState('html');

  const handleChange = (value: string) => {
    setSelected(value);
  };

  return (
    <div>
      <Tag.CheckableTag checked={selected === 'html'} onChange={() => handleChange('html')}>
        HTML
      </Tag.CheckableTag>
      <Tag.CheckableTag checked={selected === 'css'} onChange={() => handleChange('css')}>
        CSS
      </Tag.CheckableTag>
      <Tag.CheckableTag
        checked={selected === 'javascript'}
        onChange={() => handleChange('javascript')}
      >
        JavaScript
      </Tag.CheckableTag>
      <div>Selected: {selected}</div>
    </div>
  );
};

export default App;
```

### Checkable Group

Multiple checkable tags in a group.

```tsx
import React, { useState } from 'react';
import { Tag } from 'antd';

const App: React.FC = () => {
  const [selectedTags, setSelectedTags] = useState<string[]>(['React', 'Vue']);

  const handleChange = (values: string[]) => {
    setSelectedTags(values);
  };

  return (
    <Tag.CheckableTagGroup
      value={selectedTags}
      onChange={handleChange}
      options={['React', 'Vue', 'Angular', 'Svelte']}
    />
  );
};

export default App;
```

### Closable

Closable tag with close functionality.

```tsx
import React, { useState } from 'react';
import { Tag } from 'antd';

const App: React.FC = () => {
  const [tags, setTags] = useState(['Tag 1', 'Tag 2', 'Tag 3']);

  const handleClose = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
  };

  return (
    <div>
      {tags.map((tag) => (
        <Tag key={tag} closable onClose={() => handleClose(tag)}>
          {tag}
        </Tag>
      ))}
    </div>
  );
};

export default App;
```

### Custom Close Icon

Custom close icon for tags.

```tsx
import React from 'react';
import { CloseCircleFilled } from '@ant-design/icons';
import { Tag } from 'antd';

const App: React.FC = () => (
  <Tag closable closeIcon={<CloseCircleFilled />}>
    Custom Close Icon
  </Tag>
);

export default App;
```

### Variants with Custom Styling

Tag with custom variant styling.

```tsx
import React from 'react';
import { Tag } from 'antd';

const App: React.FC = () => (
  <div>
    <Tag color="processing" variant="filled">
      Processing
    </Tag>
    <Tag color="success" variant="solid">
      Success
    </Tag>
    <Tag color="error" variant="outlined">
      Error
    </Tag>
    <Tag color="warning" variant="dashed">
      Warning
    </Tag>
  </div>
);

export default App;
```

### Link Tag

Tag as a link.

```tsx
import React from 'react';
import { Tag } from 'antd';

const App: React.FC = () => (
  <Tag href="https://ant.design" target="_blank">
    Ant Design
  </Tag>
);

export default App;
```

### Semantic styling

You can customize the [semantic dom](#semantic-dom) style of Tag by passing objects/functions through `classNames` and `styles`.

```tsx
import React from 'react';
import { Tag } from 'antd';
import type { GetProp, TagProps } from 'antd';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token }) => ({
  root: {
    borderRadius: token.borderRadius,
    padding: `${token.paddingXXS}px ${token.paddingXS}px`,
    fontSize: token.fontSizeSM,
    fontWeight: 500,
    display: 'inline-block',
    transition: `all ${token.motionDurationMid}`,
    cursor: 'default',
  },
  colorBlue: {
    backgroundColor: token.colorPrimaryBg,
    color: token.colorPrimary,
    borderColor: token.colorPrimaryBorder,
  },
  colorGreen: {
    backgroundColor: token.colorSuccessBg,
    color: token.colorSuccess,
    borderColor: token.colorSuccessBorder,
  },
}));

const styles: TagProps['styles'] = {
  root: {
    borderWidth: 2,
    borderStyle: 'solid',
  },
  colorBlue: {
    fontWeight: 600,
  },
};

const App: React.FC = () => {
  const { styles: classNames } = useStyles();

  return (
    <>
      <Tag classNames={classNames} styles={styles} color="blue">
        Object Style
      </Tag>
      <Tag classNames={classNames} styles={styles} color="green">
        Object Style
      </Tag>
    </>
  );
};

export default App;
```

## API

Common props ref：[Common props](/docs/react/common-props)

### Tag props

| Property   | Description                                                                                                     | Type                                                                                                                           | Default    | Version |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- |
| closeIcon  | Custom close icon. 5.7.0: close button will be hidden when setting to `null` or `false`                         | ReactNode                                                                                                                      | false      | 4.4.0   |
| classNames | Customize class for each semantic structure inside the component. Supports object or function.                  | Record<[SemanticDOM](#semantic-dom), string> \| (info: { props })=> Record<[SemanticDOM](#semantic-dom), string>               | -          |         |
| color      | Color of the tag                                                                                                | string                                                                                                                         | -          |         |
| disabled   | Whether the tag is disabled                                                                                     | boolean                                                                                                                        | false      | 6.0.0   |
| href       | The address to jump when clicking, when this property is specified, the tag component will be rendered as an `` | string                                                                                                                         | -          | 6.0.0   |
| icon       | Set the icon of tag                                                                                             | ReactNode                                                                                                                      | -          |         |
| onClose    | Callback executed when tag is closed (can be prevented by `e.preventDefault()`)                                 | (e: React.MouseEvent<HTMLElement, MouseEvent>) => void                                                                         | -          |         |
| styles     | Customize inline style for each semantic structure inside the component. Supports object or function.           | Record<[SemanticDOM](#semantic-dom), CSSProperties> \| (info: { props })=> Record<[SemanticDOM](#semantic-dom), CSSProperties> | -          |         |
| target     | Same as target attribute of a, works when href is specified                                                     | string                                                                                                                         | -          | 6.0.0   |
| variant    | Variant of the tag                                                                                              | `'filled' \| 'solid' \| 'outlined'`                                                                                            | `'filled'` | 6.0.0   |

### Tag.CheckableTag props

| Property   | Description                                                                                           | Type                                                                                                                            | Default | Version |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| checked    | Checked status of Tag                                                                                 | boolean                                                                                                                         | false   |         |
| classNames | Customize class for each semantic structure inside the component. Supports object or function.        | Record<[SemanticDOM](#semantic-dom), string> \| (info: { props }) => Record<[SemanticDOM](#semantic-dom), string>               | -       |         |
| icon       | Set the icon of tag                                                                                   | ReactNode                                                                                                                       | -       |         |
| styles     | Customize inline style for each semantic structure inside the component. Supports object or function. | Record<[SemanticDOM](#semantic-dom), CSSProperties> \| (info: { props }) => Record<[SemanticDOM](#semantic-dom), CSSProperties> | -       |         |
| value      | Value of checked tag                                                                                  | string \| number                                                                                                                | -       |         |
| onChange   | Callback executed when Tag is checked/unchecked                                                       | (checked) => void                                                                                                               | -       |         |

### Tag.CheckableTagGroup props

| Property   | Description                                                                                           | Type                                                                                                                            | Default    | Version      |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ------- | ------------- | --- | --- |
| classNames | Customize class for each semantic structure inside the component. Supports object or function.        | Record<[SemanticDOM](#semantic-dom), string> \| (info: { props }) => Record<[SemanticDOM](#semantic-dom), string>               | -          |              |
| options    | Options for CheckableTagGroup                                                                         | { label: ReactNode; value: string                                                                                               | number }[] | -            |         |
| styles     | Customize inline style for each semantic structure inside the component. Supports object or function. | Record<[SemanticDOM](#semantic-dom), CSSProperties> \| (info: { props }) => Record<[SemanticDOM](#semantic-dom), CSSProperties> | -          |              |
| value      | Value of checked tag(s)                                                                               | string \| number \| Array<string \| number> \| null                                                                             | -          |              |
| onChange   | Callback when Tag is checked/unchecked                                                                | (value: string                                                                                                                  | number     | Array<string | number> | null) => void | -   |     |

## Semantic DOM

https://ant.design/components/tag/semantic.md

## Design Token

## Component Token (Tag)

| Token Name       | Description                          | Type   | Default Value |
| ---------------- | ------------------------------------ | ------ | ------------- |
| borderRadius     | Border radius of tag                 | number |               |
| borderWidth      | Border width of tag                  | number |               |
| fontSize         | Font size of tag                     | number |               |
| iconSize         | Icon size of tag                     | number |               |
| iconMargin       | Margin between text and icon         | number |               |
| marginInline     | Horizontal margin of tag             | number |               |
| marginBlock      | Vertical margin of tag               | number |               |
| paddingInline    | Horizontal padding of tag            | number |               |
| paddingBlock     | Vertical padding of tag              | number |               |
| colorBg          | Background color of tag              | string |               |
| colorText        | Text color of tag                    | string |               |
| colorBorder      | Border color of tag                  | string |               |
| colorIcon        | Icon color of tag                    | string |               |
| fontSizeSM       | Small font size of tag               | number |               |
| fontSizeXS       | Extra small font size of tag         | number |               |
| colorBgHover     | Background color of tag when hovered | string |               |
| colorTextHover   | Text color of tag when hovered       | string |               |
| colorBorderHover | Border color of tag when hovered     | string |               |
| colorPrimary     | Primary color of tag                 | string |               |
| colorSuccess     | Success color of tag                 | string |               |
| colorWarning     | Warning color of tag                 | string |               |
| colorInfo        | Info color of tag                    | string |               |
| colorError       | Error color of tag                   | string |               |
| colorProcessing  | Processing color of tag              | string |               |

## Global Token

| Token Name           | Description                                                                                                                                                                                                                                                                                                                                 | Type   | Default Value |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| borderRadius         | Border radius of base components                                                                                                                                                                                                                                                                                                            | number |               |
| borderRadiusSM       | SM size border radius, used in small size components, such as Segmented, Tag and other components with small border radius.                                                                                                                                                                                                                 | number |               |
| colorBgContainer     | Container background color, e.g: default button, input box, etc. Be sure not to confuse this with `colorBgElevated`.                                                                                                                                                                                                                        | string |               |
| colorBorder          | Border color of base components                                                                                                                                                                                                                                                                                                             | string |               |
| colorBorderSecondary | Slightly lighter than the default border color, this color is the same as `colorSplit`. Solid color is used.                                                                                                                                                                                                                                | string |               |
| colorError           | Used to represent the visual elements of the operation failure, such as the error Tag, error Result component, etc.                                                                                                                                                                                                                         | string |               |
| colorErrorActive     | The active state of the error color.                                                                                                                                                                                                                                                                                                        | string |               |
| colorErrorBg         | The background color of the error state.                                                                                                                                                                                                                                                                                                    | string |               |
| colorErrorBgActive   | The active state background color of the error state.                                                                                                                                                                                                                                                                                       | string |               |
| colorErrorHover      | The hover state of the error color.                                                                                                                                                                                                                                                                                                         | string |               |
| colorFill            | The darkest fill color is used to distinguish between the second and third level of fill color, and is currently only used in the hover effect of Slider.                                                                                                                                                                                   | string |               |
| colorFillSecondary   | The second level of fill color can outline the shape of the element more clearly, such as Rate, Skeleton, etc. It can also be used as the Hover state of the third level of fill color, such as Table, etc.                                                                                                                                 | string |               |
| colorFillTertiary    | The third level of fill color is used to outline the shape of the element, such as Slider, Segmented, etc. If there is no emphasis requirement, it is recommended to use the third level of fill color as the default fill color.                                                                                                           | string |               |
| colorLink            | Control the color of hyperlink.                                                                                                                                                                                                                                                                                                             | string |               |
| colorLinkActive      | Control the color of hyperlink when clicked.                                                                                                                                                                                                                                                                                                | string |               |
| colorLinkHover       | Control the color of hyperlink when hovering.                                                                                                                                                                                                                                                                                               | string |               |
| colorPrimary         | Brand color is one of the most direct visual elements to reflect the characteristics and communication of the product. After you have selected the brand color, we will automatically generate a complete color palette and assign it effective design semantics.                                                                           | string |               |
| colorPrimaryActive   | Dark active state under the main color gradient.                                                                                                                                                                                                                                                                                            | string |               |
| colorPrimaryBg       | Light background color of primary color, usually used for weak visual level selection state.                                                                                                                                                                                                                                                | string |               |
| colorPrimaryBgHover  | The hover state color corresponding to the light background color of the primary color.                                                                                                                                                                                                                                                     | string |               |
| colorSuccess         | Used to represent the token sequence of operation success, such as Result, Progress and other components will use these map tokens.                                                                                                                                                                                                         | string |               |
| colorSuccessActive   | The active state of the success color.                                                                                                                                                                                                                                                                                                      | string |               |
| colorSuccessBg       | The background color of the success state.                                                                                                                                                                                                                                                                                                  | string |               |
| colorSuccessHover    | The hover state of the success color.                                                                                                                                                                                                                                                                                                       | string |               |
| colorText            | Default text color which comply with W3C standards, and this color is also the darkest neutral color.                                                                                                                                                                                                                                       | string |               |
| colorTextDescription | Control the font color of text description.                                                                                                                                                                                                                                                                                                 | string |               |
| colorTextDisabled    | Control the color of text in disabled state.                                                                                                                                                                                                                                                                                                | string |               |
| colorTextHeading     | Control the font color of heading.                                                                                                                                                                                                                                                                                                          | string |               |
| colorWarning         | Used to represent the token sequence of operation warning, such as Alert, Progress and other components will use these map tokens.                                                                                                                                                                                                          | string |               |
| colorWarningActive   | The active state of the warning color.                                                                                                                                                                                                                                                                                                      | string |               |
| colorWarningBg       | The background color of the warning state.                                                                                                                                                                                                                                                                                                  | string |               |
| colorWarningHover    | The hover state of the warning color.                                                                                                                                                                                                                                                                                                       | string |               |
| controlHeight        | The height of the basic controls such as buttons and input boxes in Ant Design                                                                                                                                                                                                                                                              | number |               |
| fontFamily           | The font family of Ant Design prioritizes the default interface font of the system, and provides a set of alternative font libraries that are suitable for screen display to maintain the readability and readability of the font under different platforms and browsers, reflecting the friendly, stable and professional characteristics. | string |               |
| fontSize             | The most widely used font size in the design system, from which the text gradient will be derived.                                                                                                                                                                                                                                          | number |               |
| fontSizeSM           | Small font size                                                                                                                                                                                                                                                                                                                             | number |               |
| fontSizeXS           | Extra small font size                                                                                                                                                                                                                                                                                                                       | number |               |
| lineHeight           | Line height of text.                                                                                                                                                                                                                                                                                                                        | number |               |
| motionDurationFast   | Motion speed, fast speed. Used for small element animation interaction.                                                                                                                                                                                                                                                                     | string |               |
| motionDurationMid    | Motion speed, medium speed. Used for medium element animation interaction.                                                                                                                                                                                                                                                                  | string |               |
| motionDurationSlow   | Motion speed, slow speed. Used for large element animation interaction.                                                                                                                                                                                                                                                                     | string |               |
| motionEaseInOutCirc  | Preset motion curve.                                                                                                                                                                                                                                                                                                                        | string |               |
| motionEaseOutCirc    | Preset motion curve.                                                                                                                                                                                                                                                                                                                        | string |               |
| padding              | Control the padding of the element.                                                                                                                                                                                                                                                                                                         | number |               |
| paddingSM            | Control the small padding of the element.                                                                                                                                                                                                                                                                                                   | number |               |
| paddingXS            | Control the extra small padding of the element.                                                                                                                                                                                                                                                                                             | number |               |
| sizePopupArrow       | The size of the component arrow                                                                                                                                                                                                                                                                                                             | number |               |

---
