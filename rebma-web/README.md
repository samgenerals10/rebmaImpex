# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
as an expert software engineer and senior debbuger, you are to check and work on : 

OPERATION
. fix incoming goods from the port by 
1. add name of product
2. add image of product
3. auto generate date and time
4. add destinatination
5. add goods code
 *also include history to the operation sidebar
*orders approved must reflect on operations page with its ticket number also.
*goods approved must reflect on operations page 

OPERATION SIDEBAR
1. fix port cargo
2. fix fullment releases
3. fix intake records log..

MANAGEMENT
-Include history
- credit for approval should come with every details of the customer and history of the customer
SIDEBAR
1. fix port cargo approval
2. fix credit approval
3. fix global audit ledger
4. add set prices (either new goods or incoming goods or old goods)

FINANCE
- Fix payment terms payment
- fix Invoice Portal
- fix Record Inbound Payment
- fix Receipts & Tickets

1. Historical Receipts and tickets database should be in a table form and when clicked on each row or profile you should see the ticket now.
2. Include overall goods produced by production..
3. Include overall goods in warehouse history production
4. Include from like google forms


MARKETING 
1. Let create client order be a modal 
- add destination 
- add name of product
if order type is credit add customer Ghana Card...
2. let register New customer should be a modal 
- add customer photo (optional)
3. let customer directory be a table when clicked on a customer you see a card of the customer profile including history botton..
3. Let active sales orders list ,should be clickable..

DISPATCH
- Fix live map for delievery orders
- Include delievery history
- Include Drivers activies and details and Ghana Card.
DISPATCH SIDEBAR
1. fix active delieveries map
2. fix dispatch history
3. fix delievery logs history 



PRODUCTION
1.add history production
2.raw materials requested and the goods thats has been produced
sidebar
3.fix raw materials requested
4.fix WIP & stock inventory
5. fix orders history

HR
1.fix new registration approval
if approved,system auto generate login password for the person and sends it into the persons email ,if rejected or denied, send note to the persons email...

2. add members(staff)
3. todays attendance should be a list of five ,the rest can be scrolled.
4. add attendance history of staff in a table form

A FEATURE EVERY DEPARTMENT MUST HAVE AND IT SHOULDNT BE A DEPARTMENT ON ITS OWN..
1. executive boardroom - fix it and put it inside the chat icon and the sidebar for each department..
2. Settings - every department should have should have a settings at the bottom of the sidebar and add user profile settings too...(profile picture,email,password,names, delete account which hr needs to approved before account deletion becomes complete)

DEPARTMENT ACCESS IN THE SIDEBAR
1. only CEO,MANAGEMENT,should only have access to a view only mode to all department but management cant have access to view CEO department..

1. let Ceo handle logistics..
SIDEBAR CEO
2. fix Accra GPS tracking
3. fix boardroom hub
4. fix erp settings

LET WHATEVER I CLICKED FROM THE SIDEBAR OCCUPY AND REPLACE THE MAIN HEIGHT OR SCROLL DOWN...

FIX NOTIFICATION ALSO..

