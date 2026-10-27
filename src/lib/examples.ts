import type { AnalyzeInput } from "./types";

export const examples: {
  id: string;
  title: string;
  subtitle: string;
  input: AnalyzeInput;
}[] = [
  {
    id: "next",
    title: "Next.js",
    subtitle: "14.2 → 16.0",
    input: {
      exampleId: "next",
      bumps: [{ name: "next", from: "14.2.0", to: "16.0.0" }],
      files: [
        {
          path: "app/dashboard/page.tsx",
          content:
            "import { cookies, headers } from 'next/headers';\n\nexport default function Dashboard() {\n  const session = cookies().get('session');\n  const agent = headers().get('user-agent');\n  return <main>Hello {session?.value} — {agent}</main>;\n}\n",
        },
        {
          path: "next.config.js",
          content:
            "module.exports = {\n  experimental: { ppr: true },\n  eslint: { ignoreDuringBuilds: true },\n  images: { domains: ['images.example.com'] },\n};\n",
        },
        {
          path: "middleware.ts",
          content:
            "import { NextResponse } from 'next/server';\n\nexport function middleware(request) {\n  return NextResponse.next();\n}\n",
        },
      ],
    },
  },
  {
    id: "router",
    title: "React Router",
    subtitle: "5.3 → 6.22",
    input: {
      exampleId: "router",
      bumps: [{ name: "react-router-dom", from: "5.3.4", to: "6.22.0" }],
      files: [
        {
          path: "src/App.tsx",
          content:
            "import { BrowserRouter, Switch, Route, Redirect } from 'react-router-dom';\nimport { Home, Login } from './pages';\n\nexport default function App() {\n  return <BrowserRouter>\n    <Switch>\n      <Route exact path='/' component={Home} />\n      <Route path='/login' render={() => <Login />} />\n      <Redirect to='/' />\n    </Switch>\n  </BrowserRouter>;\n}\n",
        },
        {
          path: "src/BackButton.tsx",
          content:
            "import { useHistory } from 'react-router-dom';\n\nexport function BackButton() {\n  const history = useHistory();\n  return <button onClick={() => history.goBack()}>Go back</button>;\n}\n",
        },
      ],
    },
  },
  {
    id: "eslint",
    title: "ESLint",
    subtitle: "8 → 9",
    input: {
      exampleId: "eslint",
      bumps: [{ name: "eslint", from: "8.57.1", to: "9.0.0" }],
      files: [
        {
          path: ".eslintrc.json",
          content:
            '{\n  "root": true,\n  "env": { "browser": true, "es2021": true },\n  "extends": ["eslint:recommended"],\n  "rules": { "valid-jsdoc": "error", "require-jsdoc": "warn" }\n}\n',
        },
        {
          path: "src/rules/no-legacy.js",
          content:
            "module.exports = {\n  meta: { type: 'problem', schema: [] },\n  create(context) {\n    const source = context.getSource();\n    return {\n      Identifier(node) {\n        const scope = context.getScope();\n        if (node.name === 'legacy') context.report({ node, message: 'Replace legacy' });\n      }\n    };\n  }\n};\n",
        },
      ],
    },
  },
];
