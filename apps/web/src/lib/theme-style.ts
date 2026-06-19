import { cssVarBlock, lightTheme, darkTheme } from '@car-rental/tokens/server';

export const rootThemeCss = `:root { ${cssVarBlock(lightTheme)} } [data-theme="dark"] { ${cssVarBlock(darkTheme)} }`;
