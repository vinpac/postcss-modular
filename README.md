# postcss-modular
PostCSS plugin to modularize classnames

## Installation
```
# yarn
yarn add --dev postcss-modular
# npm
npm install --dev postcss-modular
```

## Examples
```
// foo.css ====================
:local(.className) { background: red; }
:local .className { color: green; }
:local(.className .subClass) { color: green; }
:local .className .subClass :global(.global-class-name) { color: blue; }

// bar.css ====================
@use .className as .basicClassName from './foo';

.basicClassName { color: red; }
.className { color: blue; }
```
Becomes
```
// foo.css ====================
._className_wo9uw_1 { background: red; }
 ._className_wo9uw_1 { color: green; }
._className_wo9uw_1 ._subClass_wo9uw_3 { color: green; }
 ._className_wo9uw_1 ._subClass_wo9uw_3 .global-class-name { color: blue; }

// bar.css ====================
._className_wo9uw_1 { color: red; }
._className_c6lnr_1 { color: blue; }
```

Note that this `postcss-modular` plugin can use classNames from different files with the rule `@use`, even if they are localized. This makes theming possible and reduces code.

## Features

### @use
`@use .className[ as .label][, ...] from '<filepath>'`

Points to the same className from other file, thus using the same hashed name.

**Note**: If the option `useNoImported` is equals `'error'` the referenced file must be proccessed before the referencer. With `ignore` value, it will just work fine.

### :global
`:global .className` or `:global(.className .subClassName)`

Creates a global scope so the classNames won't be hashed

### :local

Creates a local scope so the classNames will be hashed

**Note**: The option modules defines the default scope of the file. `true` = local, `false` = global



## Options

|Name|Type|Default|Description|
|:--|:--|:-----|:----------|
|**`modules`**|`{Boolean}`|`true`|Enable/Disable CSS Modules|
|**`camelCase`**|`{Boolean}`|`false`|Export Classnames in CamelCase|
|**`useNoImported`**|`{error\|warn\|ignore}`|`error`|Handle no imported css files in @use |
|**`extension`**|`{String}`|`.css`|File extension when omitted in @use |
|**`generateScopedName`**|`{Function}`|`_[name]_[hash:5]_[lineNumber]`|Arguments: className, cssBody|
