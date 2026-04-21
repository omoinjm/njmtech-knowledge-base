Title: Using the Python Runtime with Vercel Functions

URL Source: https://vercel.com/docs/functions/runtimes/python

Markdown Content:
Using the Python Runtime with Vercel Functions
===============

[![Image 1: VercelLogotype](https://vercel.com/vc-ap-vercel-docs/_next/static/media/vercel-logotype-light.64164313.svg?dpl=dpl_AdqtP6Jweus774M9EC2RDSgpzb3q)![Image 2: VercelLogotype](https://vercel.com/vc-ap-vercel-docs/_next/static/media/vercel-logotype-dark.49dd0a95.svg?dpl=dpl_AdqtP6Jweus774M9EC2RDSgpzb3q)](https://vercel.com/home)

![Image 3: Vercel](https://vercel.com/vc-ap-vercel-docs/_next/static/media/vercel-light.cb298fd7.svg?dpl=dpl_AdqtP6Jweus774M9EC2RDSgpzb3q)![Image 4: Vercel](https://vercel.com/vc-ap-vercel-docs/_next/static/media/vercel-dark.d798e77e.svg?dpl=dpl_AdqtP6Jweus774M9EC2RDSgpzb3q)

- Products
  - ##### [AI Cloud](https://vercel.com/ai)
    - [v0 Build applications with AI](https://v0.app/)
    - [AI SDK The AI Toolkit for TypeScript](https://sdk.vercel.ai/)
    - [AI Gateway One endpoint, all your models](https://vercel.com/ai-gateway)
    - [Vercel Agent An agent that knows your stack](https://vercel.com/agent)
    - [Sandbox AI workflows in live environments](https://vercel.com/sandbox)

  - ##### Core Platform
    - [CI/CD Helping teams ship 6× faster](https://vercel.com/products/previews)
    - [Content Delivery Fast, scalable, and reliable](https://vercel.com/products/rendering)
    - [Fluid Compute Servers, in serverless form](https://vercel.com/fluid)
    - [Observability Trace every step](https://vercel.com/products/observability)

  - ##### [Security](https://vercel.com/security)
    - [Bot Management Scalable bot protection](https://vercel.com/security/bot-management)
    - [BotID Invisible CAPTCHA](https://vercel.com/botid)
    - [Platform Security DDoS Protection, Firewall](https://vercel.com/security)
    - [Web Application Firewall Granular, custom protection](https://vercel.com/security/web-application-firewall)

- Resources
  - ##### Company
    - [Customers Trusted by the best teams](https://vercel.com/customers)
    - [Blog The latest posts and changes](https://vercel.com/blog)
    - [Changelog See what shipped](https://vercel.com/changelog)
    - [Press Read the latest news](https://vercel.com/press)
    - [Events Join us at an event](https://vercel.com/events)

  - ##### Learn
    - [Docs Vercel documentation](https://vercel.com/docs)
    - [Academy Linear courses to level up](https://vercel.com/academy)
    - [Knowledge Base Find help quickly](https://vercel.com/kb)
    - [Community Join the conversation](https://community.vercel.com/)

  - ##### Open Source
    - [Next.js The native Next.js platform](https://vercel.com/frameworks/nextjs)
    - [Nuxt The progressive web framework](https://nuxt.com/)
    - [Svelte The web’s efficient UI framework](https://svelte.dev/)
    - [Turborepo Speed with Enterprise scale](https://vercel.com/solutions/turborepo)

- Solutions
  - ##### Use Cases
    - [AI Apps Deploy at the speed of AI](https://vercel.com/solutions/ai-apps)
    - [Composable Commerce Power storefronts that convert](https://vercel.com/solutions/composable-commerce)
    - [Marketing Sites Launch campaigns fast](https://vercel.com/solutions/marketing-sites)
    - [Multi-tenant Platforms Scale apps with one codebase](https://vercel.com/solutions/multi-tenant-saas)
    - [Web Apps Ship features, not infrastructure](https://vercel.com/solutions/web-apps)

  - ##### Tools
    - [Marketplace Extend and automate workflows](https://vercel.com/marketplace)
    - [Templates Jumpstart app development](https://vercel.com/templates)
    - [Partner Finder Get help from solution partners](https://vercel.com/partners/solution-partners)

  - ##### Users
    - [Platform Engineers Automate away repetition](https://vercel.com/solutions/platform-engineering)
    - [Design Engineers Deploy for every idea](https://vercel.com/solutions/design-engineering)

- [Enterprise](https://vercel.com/enterprise)
- [Pricing](https://vercel.com/pricing)

Search Documentation Search...⌘ K

Ask AI

Search Documentation Search...⌘ K

Ask AI

[Functions](https://vercel.com/docs/functions)

[Runtimes](https://vercel.com/docs/functions/runtimes)

Python

Docs

API Reference

- [Getting Started](https://vercel.com/docs/getting-started-with-vercel) Expand menu
  - [Projects and Deployments](https://vercel.com/docs/getting-started-with-vercel/projects-deployments)
  - [Use a Template](https://vercel.com/docs/getting-started-with-vercel/template)
  - [Import Existing Project](https://vercel.com/docs/getting-started-with-vercel/import)
  - [Add a Domain](https://vercel.com/docs/getting-started-with-vercel/domains)
  - [Buy a Domain](https://vercel.com/docs/getting-started-with-vercel/buy-domain)
  - [Transfer an Existing Domain](https://vercel.com/docs/getting-started-with-vercel/use-existing)
  - [Collaborate](https://vercel.com/docs/getting-started-with-vercel/collaborate)
  - [Next Steps](https://vercel.com/docs/getting-started-with-vercel/next-steps)

- [Supported Frameworks](https://vercel.com/docs/frameworks) Expand menu
  - [Full-stack](https://vercel.com/docs/frameworks/full-stack) Expand menu
    - [Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs)
    - [SvelteKit](https://vercel.com/docs/frameworks/full-stack/sveltekit)
    - [Nuxt](https://vercel.com/docs/frameworks/full-stack/nuxt)
    - [Remix](https://vercel.com/docs/frameworks/full-stack/remix)
    - [TanStack Start](https://vercel.com/docs/frameworks/full-stack/tanstack-start)

  - [Frontends](https://vercel.com/docs/frameworks/frontend) Expand menu
    - [Astro](https://vercel.com/docs/frameworks/frontend/astro)
    - [Vite](https://vercel.com/docs/frameworks/frontend/vite)
    - [React Router](https://vercel.com/docs/frameworks/frontend/react-router)
    - [Create React App](https://vercel.com/docs/frameworks/frontend/create-react-app)

  - [Backends](https://vercel.com/docs/frameworks/backend) Expand menu
    - [Nitro](https://vercel.com/docs/frameworks/backend/nitro)
    - [Express](https://vercel.com/docs/frameworks/backend/express)
    - [Elysia](https://vercel.com/docs/frameworks/backend/elysia)
    - [FastAPI](https://vercel.com/docs/frameworks/backend/fastapi)
    - [Fastify](https://vercel.com/docs/frameworks/backend/fastify)
    - [Flask](https://vercel.com/docs/frameworks/backend/flask)
    - [Hono](https://vercel.com/docs/frameworks/backend/hono)
    - [NestJS](https://vercel.com/docs/frameworks/backend/nestjs)
    - [xmcp](https://vercel.com/docs/frameworks/backend/xmcp)

  - [All Frameworks](https://vercel.com/docs/frameworks/more-frameworks)

- [Incremental Migration](https://vercel.com/docs/incremental-migration)
- [Production Checklist](https://vercel.com/docs/production-checklist)
- [Knowledge Base](https://vercel.com/kb)
- [Docs llms-full.txt](https://vercel.com/docs/llms-full.txt)

---

- Access Expand menu
  - [Account Management](https://vercel.com/docs/accounts)
  - [Sign in with Vercel](https://vercel.com/docs/sign-in-with-vercel) Expand menu
    - [Getting Started](https://vercel.com/docs/sign-in-with-vercel/getting-started)
    - [Scopes & Permissions](https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions)
    - [Tokens](https://vercel.com/docs/sign-in-with-vercel/tokens)
    - [Authorization Server API](https://vercel.com/docs/sign-in-with-vercel/authorization-server-api)
    - [Manage from Dashboard](https://vercel.com/docs/sign-in-with-vercel/manage-from-dashboard)
    - [Consent Page](https://vercel.com/docs/sign-in-with-vercel/consent-page)
    - [Troubleshooting](https://vercel.com/docs/sign-in-with-vercel/troubleshooting)

  - [Activity Log](https://vercel.com/docs/activity-log)
  - [Deployment Protection](https://vercel.com/docs/deployment-protection) Expand menu
    - [Bypass Deployment Protection](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection) Expand menu
      - [Exceptions](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions)
      - [OPTIONS Allowlist](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/options-allowlist)
      - [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
      - [Sharable Links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links)

    - [Protect Deployments](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments) Expand menu
      - [Password Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/password-protection)
      - [Trusted IPs](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/trusted-ips)
      - [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)

  - [Directory Sync](https://vercel.com/docs/directory-sync)
  - [SAML SSO](https://vercel.com/docs/saml)
  - [Two-factor (2FA)](https://vercel.com/docs/two-factor-authentication)

- AI Expand menu
  - [Vercel Agent](https://vercel.com/docs/agent) Expand menu
    - [Code Review beta](https://vercel.com/docs/agent/pr-review) Expand menu
      - [Managing Reviews](https://vercel.com/docs/agent/pr-review/usage)

    - [Investigation beta](https://vercel.com/docs/agent/investigation)
    - [Pricing](https://vercel.com/docs/agent/pricing)

  - [AI SDK](https://vercel.com/docs/ai-sdk)
  - [AI Gateway](https://vercel.com/docs/ai-gateway) Expand menu
    - [Getting Started](https://vercel.com/docs/ai-gateway/getting-started)
    - [Models & Providers](https://vercel.com/docs/ai-gateway/models-and-providers)
    - [Observability](https://vercel.com/docs/ai-gateway/observability)
    - [Pricing](https://vercel.com/docs/ai-gateway/pricing)
    - [Provider Options](https://vercel.com/docs/ai-gateway/provider-options)
    - [Anthropic-Compatible API](https://vercel.com/docs/ai-gateway/anthropic-compat)
    - [OpenAI-Compatible API](https://vercel.com/docs/ai-gateway/openai-compat)
    - [Authentication](https://vercel.com/docs/ai-gateway/authentication)
    - [BYOK](https://vercel.com/docs/ai-gateway/byok)
    - [Usage & Billing](https://vercel.com/docs/ai-gateway/usage)
    - [Framework Integrations](https://vercel.com/docs/ai-gateway/framework-integrations) Expand menu
      - [LangChain](https://vercel.com/docs/ai-gateway/framework-integrations/langchain)
      - [LangFuse](https://vercel.com/docs/ai-gateway/framework-integrations/langfuse)
      - [LiteLLM](https://vercel.com/docs/ai-gateway/framework-integrations/litellm)
      - [LlamaIndex](https://vercel.com/docs/ai-gateway/framework-integrations/llamaindex)
      - [Mastra](https://vercel.com/docs/ai-gateway/framework-integrations/mastra)
      - [Pydantic AI](https://vercel.com/docs/ai-gateway/framework-integrations/pydantic-ai)

    - [App Attribution](https://vercel.com/docs/ai-gateway/app-attribution)
    - [Image Generation](https://vercel.com/docs/ai-gateway/image-generation) Expand menu
      - [Using AI SDK](https://vercel.com/docs/ai-gateway/image-generation/ai-sdk)
      - [Using OpenAI-Compatible API](https://vercel.com/docs/ai-gateway/image-generation/openai)

    - [Model Variants](https://vercel.com/docs/ai-gateway/model-variants)
    - [Zero Data Retention](https://vercel.com/docs/ai-gateway/zdr)

  - [MCP](https://vercel.com/docs/mcp) Expand menu
    - [Deploy MCP servers](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
    - [Vercel MCP server beta](https://vercel.com/docs/mcp/vercel-mcp) Expand menu
      - [Tools](https://vercel.com/docs/mcp/vercel-mcp/tools)

  - [Integrations for Agents](https://vercel.com/docs/agent-integrations)
  - [Integrations for Models](https://vercel.com/docs/ai) Expand menu
    - [Adding a Provider](https://vercel.com/docs/ai/adding-a-provider)
    - [Adding a Model](https://vercel.com/docs/ai/adding-a-model)
    - [xAI](https://vercel.com/docs/ai/xai)
    - [Groq](https://vercel.com/docs/ai/groq)
    - [fal](https://vercel.com/docs/ai/fal)
    - [Deep Infra](https://vercel.com/docs/ai/deepinfra)
    - [ElevenLabs](https://vercel.com/docs/ai/elevenlabs)
    - [LMNT](https://vercel.com/docs/ai/lmnt)
    - [OpenAI](https://vercel.com/docs/ai/openai)
    - [Perplexity](https://vercel.com/docs/ai/perplexity)
    - [Pinecone](https://vercel.com/docs/ai/pinecone)
    - [Replicate](https://vercel.com/docs/ai/replicate)
    - [Together AI](https://vercel.com/docs/ai/togetherai)

- Build & Deploy Expand menu
  - [Builds](https://vercel.com/docs/builds) Expand menu
    - [Build Features](https://vercel.com/docs/builds/build-features)
    - [Build Image](https://vercel.com/docs/builds/build-image)
    - [Build Queues](https://vercel.com/docs/builds/build-queues)
    - [Configuring a Build](https://vercel.com/docs/builds/configure-a-build)
    - [Managing Builds](https://vercel.com/docs/builds/managing-builds)

  - [Deploy Hooks](https://vercel.com/docs/deploy-hooks)
  - [Deployment Checks](https://vercel.com/docs/deployment-checks)
  - [Deployment Retention](https://vercel.com/docs/deployment-retention)
  - [Deployments](https://vercel.com/docs/deployments) Expand menu
    - [Environments](https://vercel.com/docs/deployments/environments)
    - [Generated URLs](https://vercel.com/docs/deployments/generated-urls)
    - [Managing Deployments](https://vercel.com/docs/deployments/managing-deployments)
    - [Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)
    - [Troubleshoot Build Errors](https://vercel.com/docs/deployments/troubleshoot-a-build)
    - [Accessing Build Logs](https://vercel.com/docs/deployments/logs)
    - [Claim Deployments](https://vercel.com/docs/deployments/claim-deployments)
    - [Inspect OG Metadata](https://vercel.com/docs/deployments/og-preview)
    - [Preview Deployment Suffix](https://vercel.com/docs/deployments/preview-deployment-suffix)
    - [Sharing a Preview Deployment](https://vercel.com/docs/deployments/sharing-deployments)
    - [Troubleshoot project collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration)

  - [Environment Variables](https://vercel.com/docs/environment-variables) Expand menu
    - [Framework Environment Variables](https://vercel.com/docs/environment-variables/framework-environment-variables)
    - [Managing Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
    - [Reserved Environment Variables](https://vercel.com/docs/environment-variables/reserved-environment-variables)
    - [Rotating Environment Variables](https://vercel.com/docs/environment-variables/rotating-secrets)
    - [Sensitive Environment Variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
    - [Shared Environment Variables](https://vercel.com/docs/environment-variables/shared-environment-variables)
    - [System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)

  - [Git Integrations](https://vercel.com/docs/git) Expand menu
    - [GitHub](https://vercel.com/docs/git/vercel-for-github)
    - [Azure DevOps](https://vercel.com/docs/git/vercel-for-azure-pipelines)
    - [Bitbucket](https://vercel.com/docs/git/vercel-for-bitbucket)
    - [GitLab](https://vercel.com/docs/git/vercel-for-gitlab)

  - [Instant Rollback](https://vercel.com/docs/instant-rollback)
  - [Microfrontends](https://vercel.com/docs/microfrontends) Expand menu
    - [Getting Started](https://vercel.com/docs/microfrontends/quickstart)
    - [Local Development](https://vercel.com/docs/microfrontends/local-development)
    - [Path Routing](https://vercel.com/docs/microfrontends/path-routing)
    - [Configuration](https://vercel.com/docs/microfrontends/configuration)
    - [Managing Microfrontends](https://vercel.com/docs/microfrontends/managing-microfrontends) Expand menu
      - [Security](https://vercel.com/docs/microfrontends/managing-microfrontends/security)
      - [Using Vercel Toolbar](https://vercel.com/docs/microfrontends/managing-microfrontends/vercel-toolbar)

    - [Testing & Troubleshooting](https://vercel.com/docs/microfrontends/troubleshooting)

  - [Monorepos](https://vercel.com/docs/monorepos) Expand menu
    - [Turborepo](https://vercel.com/docs/monorepos/turborepo)
    - [Remote Caching](https://vercel.com/docs/monorepos/remote-caching)
    - [Nx](https://vercel.com/docs/monorepos/nx)
    - [Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq)

  - [Package Managers](https://vercel.com/docs/package-managers)
  - [Restricting Git Connections to a single Vercel team](https://vercel.com/docs/protected-git-scopes)
  - [Rolling Releases](https://vercel.com/docs/rolling-releases)
  - [Skew Protection](https://vercel.com/docs/skew-protection)
  - [Webhooks](https://vercel.com/docs/webhooks) Expand menu
    - [Webhooks API Reference](https://vercel.com/docs/webhooks/webhooks-api)

- CDN Expand menu
  - [Overview](https://vercel.com/docs/cdn)
  - [Regions](https://vercel.com/docs/regions)
  - [Headers](https://vercel.com/docs/headers) Expand menu
    - [Security Headers](https://vercel.com/docs/headers/security-headers)
    - [Cache-Control Headers](https://vercel.com/docs/headers/cache-control-headers)
    - [Request Headers](https://vercel.com/docs/headers/request-headers)
    - [Response Headers](https://vercel.com/docs/headers/response-headers)

  - [CDN Cache](https://vercel.com/docs/cdn-cache) Expand menu
    - [Purge CDN Cache](https://vercel.com/docs/cdn-cache/purge)

  - [Encryption](https://vercel.com/docs/encryption)
  - [Compression](https://vercel.com/docs/compression)
  - [Incremental Static Regeneration](https://vercel.com/docs/incremental-static-regeneration) Expand menu
    - [Getting Started](https://vercel.com/docs/incremental-static-regeneration/quickstart)
    - [Usage & Pricing](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing)

  - [Redirects](https://vercel.com/docs/redirects) Expand menu
    - [Configuration Redirects](https://vercel.com/docs/redirects/configuration-redirects)
    - [Bulk redirects](https://vercel.com/docs/redirects/bulk-redirects) Expand menu
      - [Getting Started](https://vercel.com/docs/redirects/bulk-redirects/getting-started)

  - [Rewrites](https://vercel.com/docs/rewrites)
  - [Image Optimization](https://vercel.com/docs/image-optimization) Expand menu
    - [Getting Started](https://vercel.com/docs/image-optimization/quickstart)
    - [Limits and Pricing](https://vercel.com/docs/image-optimization/limits-and-pricing)
    - [Managing Usage & Costs](https://vercel.com/docs/image-optimization/managing-image-optimization-costs)
    - [Legacy Pricing](https://vercel.com/docs/image-optimization/legacy-pricing)

  - [Manage CDN Usage](https://vercel.com/docs/manage-cdn-usage)
  - [Request Collapsing](https://vercel.com/docs/request-collapsing)

- [CLI](https://vercel.com/docs/cli) Expand menu
  - [Deploying from CLI](https://vercel.com/docs/cli/deploying-from-cli)
  - [Project Linking](https://vercel.com/docs/cli/project-linking)
  - [Telemetry](https://vercel.com/docs/cli/about-telemetry)
  - [Global Options](https://vercel.com/docs/cli/global-options)
  - [`vercel alias`](https://vercel.com/docs/cli/alias)
  - [`vercel bisect`](https://vercel.com/docs/cli/bisect)
  - [`vercel blob`](https://vercel.com/docs/cli/blob)
  - [`vercel build`](https://vercel.com/docs/cli/build)
  - [`vercel cache`](https://vercel.com/docs/cli/cache)
  - [`vercel certs`](https://vercel.com/docs/cli/certs)
  - [`vercel curl`](https://vercel.com/docs/cli/curl)
  - [`vercel deploy`](https://vercel.com/docs/cli/deploy)
  - [`vercel dev`](https://vercel.com/docs/cli/dev)
  - [`vercel dns`](https://vercel.com/docs/cli/dns)
  - [`vercel domains`](https://vercel.com/docs/cli/domains)
  - [`vercel env`](https://vercel.com/docs/cli/env)
  - [`vercel git`](https://vercel.com/docs/cli/git)
  - [`vercel help`](https://vercel.com/docs/cli/help)
  - [`vercel httpstat`](https://vercel.com/docs/cli/httpstat)
  - [`vercel init`](https://vercel.com/docs/cli/init)
  - [`vercel inspect`](https://vercel.com/docs/cli/inspect)
  - [`vercel install`](https://vercel.com/docs/cli/install)
  - [`vercel integration`](https://vercel.com/docs/cli/integration)
  - [`vercel integration-resource`](https://vercel.com/docs/cli/integration-resource)
  - [`vercel link`](https://vercel.com/docs/cli/link)
  - [`vercel list`](https://vercel.com/docs/cli/list)
  - [`vercel login`](https://vercel.com/docs/cli/login)
  - [`vercel logout`](https://vercel.com/docs/cli/logout)
  - [`vercel logs`](https://vercel.com/docs/cli/logs)
  - [`vercel open`](https://vercel.com/docs/cli/open)
  - [`vercel project`](https://vercel.com/docs/cli/project)
  - [`vercel promote`](https://vercel.com/docs/cli/promote)
  - [`vercel pull`](https://vercel.com/docs/cli/pull)
  - [`vercel redeploy`](https://vercel.com/docs/cli/redeploy)
  - [`vercel redirects`](https://vercel.com/docs/cli/redirects)
  - [`vercel remove`](https://vercel.com/docs/cli/remove)
  - [`vercel rollback`](https://vercel.com/docs/cli/rollback)
  - [`vercel rolling-release`](https://vercel.com/docs/cli/rolling-release)
  - [`vercel switch`](https://vercel.com/docs/cli/switch)
  - [`vercel teams`](https://vercel.com/docs/cli/teams)
  - [`vercel telemetry`](https://vercel.com/docs/cli/telemetry)
  - [`vercel whoami`](https://vercel.com/docs/cli/whoami)

- Collaboration Expand menu
  - [Comments](https://vercel.com/docs/comments) Expand menu
    - [Enabling Comments](https://vercel.com/docs/comments/how-comments-work)
    - [Using Comments](https://vercel.com/docs/comments/using-comments)
    - [Managing Comments](https://vercel.com/docs/comments/managing-comments)
    - [Integrations](https://vercel.com/docs/comments/integrations)

  - [Draft Mode](https://vercel.com/docs/draft-mode)
  - [Edit Mode](https://vercel.com/docs/edit-mode)
  - [Feature Flags](https://vercel.com/docs/feature-flags) Expand menu
    - [Flags Explorer](https://vercel.com/docs/feature-flags/flags-explorer) Expand menu
      - [Getting Started](https://vercel.com/docs/feature-flags/flags-explorer/getting-started)
      - [Reference](https://vercel.com/docs/feature-flags/flags-explorer/reference)
      - [Pricing](https://vercel.com/docs/feature-flags/flags-explorer/limits-and-pricing)

    - [Flags SDK](https://vercel.com/docs/feature-flags/feature-flags-pattern)
    - [With Runtime Logs](https://vercel.com/docs/feature-flags/integrate-with-runtime-logs)
    - [With Vercel Platform](https://vercel.com/docs/feature-flags/integrate-vercel-platform)
    - [With Web Analytics](https://vercel.com/docs/feature-flags/integrate-with-web-analytics)

  - [Toolbar](https://vercel.com/docs/vercel-toolbar) Expand menu
    - [Add to Environments](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost) Expand menu
      - [Add to Localhost](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost/add-to-localhost)
      - [Add to Production](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost/add-to-production)

    - [Managing Toolbar](https://vercel.com/docs/vercel-toolbar/managing-toolbar)
    - [Browser Extensions](https://vercel.com/docs/vercel-toolbar/browser-extension)
    - [Accessibility Audit Tool](https://vercel.com/docs/vercel-toolbar/accessibility-audit-tool)
    - [Interaction Timing Tool](https://vercel.com/docs/vercel-toolbar/interaction-timing-tool)
    - [Layout Shift Tool](https://vercel.com/docs/vercel-toolbar/layout-shift-tool)

- Compute Expand menu
  - [Fluid Compute](https://vercel.com/docs/fluid-compute)
  - [Functions](https://vercel.com/docs/functions) Expand menu
    - [Getting Started](https://vercel.com/docs/functions/quickstart)
    - [Streaming](https://vercel.com/docs/functions/streaming-functions)
    - [Runtimes](https://vercel.com/docs/functions/runtimes) Expand menu
      - [Node.js](https://vercel.com/docs/functions/runtimes/node-js) Expand menu
        - [Advanced Node.js Usage](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration)
        - [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

      - [Bun](https://vercel.com/docs/functions/runtimes/bun)
      - [Python](https://vercel.com/docs/functions/runtimes/python)
      - [Rust](https://vercel.com/docs/functions/runtimes/rust)
      - [Go Runtime Go](https://vercel.com/docs/functions/runtimes/go)
      - [Ruby](https://vercel.com/docs/functions/runtimes/ruby)
      - [Wasm](https://vercel.com/docs/functions/runtimes/wasm)
      - [Edge Runtime](https://vercel.com/docs/functions/runtimes/edge)

    - [Configuring Functions](https://vercel.com/docs/functions/configuring-functions) Expand menu
      - [Duration](https://vercel.com/docs/functions/configuring-functions/duration)
      - [Memory](https://vercel.com/docs/functions/configuring-functions/memory)
      - [Runtime](https://vercel.com/docs/functions/configuring-functions/runtime)
      - [Region](https://vercel.com/docs/functions/configuring-functions/region)
      - [Advanced Configuration](https://vercel.com/docs/functions/configuring-functions/advanced-configuration)

    - [API Reference](https://vercel.com/docs/functions/functions-api-reference) Expand menu
      - [Node.js](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
      - [Python](https://vercel.com/docs/functions/functions-api-reference/vercel-sdk-python)

    - [Logs](https://vercel.com/docs/functions/logs)
    - [Limits](https://vercel.com/docs/functions/limitations)
    - [Concurrency Scaling](https://vercel.com/docs/functions/concurrency-scaling)
    - [Pricing](https://vercel.com/docs/functions/usage-and-pricing) Expand menu
      - [Legacy Usage & Pricing](https://vercel.com/docs/functions/usage-and-pricing/legacy-pricing)

  - [Data Cache](https://vercel.com/docs/data-cache)
  - [Routing Middleware](https://vercel.com/docs/routing-middleware) Expand menu
    - [Getting Started](https://vercel.com/docs/routing-middleware/getting-started)
    - [API](https://vercel.com/docs/routing-middleware/api)

  - [Cron Jobs](https://vercel.com/docs/cron-jobs) Expand menu
    - [Getting Started](https://vercel.com/docs/cron-jobs/quickstart)
    - [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
    - [Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)

  - [OG Image Generation](https://vercel.com/docs/og-image-generation) Expand menu
    - [`@vercel/og`](https://vercel.com/docs/og-image-generation/og-image-api)
    - [Examples](https://vercel.com/docs/og-image-generation/examples)

  - [Sandbox beta](https://vercel.com/docs/vercel-sandbox) Expand menu
    - [CLI Reference](https://vercel.com/docs/vercel-sandbox/cli-reference)
    - [Examples](https://vercel.com/docs/vercel-sandbox/examples)
    - [Pricing and Limits](https://vercel.com/docs/vercel-sandbox/pricing)

  - [Workflow beta](https://vercel.com/docs/workflow)

- [Multi-tenant](https://vercel.com/docs/multi-tenant) Expand menu
  - [Domain Management](https://vercel.com/docs/multi-tenant/domain-management)
  - [Limits](https://vercel.com/docs/multi-tenant/limits)

- Observability Expand menu
  - [Overview](https://vercel.com/docs/observability) Expand menu
    - [Insights](https://vercel.com/docs/observability/insights)
    - [Observability Plus](https://vercel.com/docs/observability/observability-plus)

  - [Alerts beta](https://vercel.com/docs/alerts)
  - [Logs](https://vercel.com/docs/logs) Expand menu
    - [Runtime](https://vercel.com/docs/logs/runtime)

  - [Tracing](https://vercel.com/docs/tracing) Expand menu
    - [Instrumentation](https://vercel.com/docs/tracing/instrumentation)
    - [Session Tracing](https://vercel.com/docs/tracing/session-tracing)

  - [Query](https://vercel.com/docs/query) Expand menu
    - [Query Reference](https://vercel.com/docs/query/reference)
    - [Monitoring](https://vercel.com/docs/query/monitoring) Expand menu
      - [Getting Started](https://vercel.com/docs/query/monitoring/quickstart)
      - [Monitoring Reference](https://vercel.com/docs/query/monitoring/monitoring-reference)
      - [Limits and Pricing](https://vercel.com/docs/query/monitoring/limits-and-pricing)

  - [Notebooks](https://vercel.com/docs/notebooks)
  - [Speed Insights](https://vercel.com/docs/speed-insights) Expand menu
    - [Getting Started](https://vercel.com/docs/speed-insights/quickstart)
    - [Using Speed Insights](https://vercel.com/docs/speed-insights/using-speed-insights)
    - [Metrics](https://vercel.com/docs/speed-insights/metrics)
    - [Privacy](https://vercel.com/docs/speed-insights/privacy-policy)
    - [`@vercel/speed-insights`](https://vercel.com/docs/speed-insights/package)
    - [Limits and Pricing](https://vercel.com/docs/speed-insights/limits-and-pricing)
    - [Troubleshooting](https://vercel.com/docs/speed-insights/troubleshooting)
    - [Migrating from Legacy](https://vercel.com/docs/speed-insights/migrating-from-legacy)

  - [Drains](https://vercel.com/docs/drains) Expand menu
    - [Using Drains](https://vercel.com/docs/drains/using-drains)
    - Reference Expand menu
      - [Logs](https://vercel.com/docs/drains/reference/logs)
      - [Traces](https://vercel.com/docs/drains/reference/traces)
      - [Speed Insights](https://vercel.com/docs/drains/reference/speed-insights)
      - [Web Analytics](https://vercel.com/docs/drains/reference/analytics)

    - [Security](https://vercel.com/docs/drains/security)

  - [Web Analytics](https://vercel.com/docs/analytics) Expand menu
    - [Getting Started](https://vercel.com/docs/analytics/quickstart)
    - [Using Web Analytics](https://vercel.com/docs/analytics/using-web-analytics)
    - [Filtering](https://vercel.com/docs/analytics/filtering)
    - [Custom Events](https://vercel.com/docs/analytics/custom-events)
    - [Redacting Sensitive Data](https://vercel.com/docs/analytics/redacting-sensitive-data)
    - [Privacy](https://vercel.com/docs/analytics/privacy-policy)
    - [`@vercel/analytics`](https://vercel.com/docs/analytics/package)
    - [Pricing](https://vercel.com/docs/analytics/limits-and-pricing)
    - [Troubleshooting](https://vercel.com/docs/analytics/troubleshooting)

  - [Manage & Optimize](https://vercel.com/docs/manage-and-optimize-observability)

- Platform Expand menu
  - [Project Configuration](https://vercel.com/docs/project-configuration) Expand menu
    - [vercel.json](https://vercel.com/docs/project-configuration/vercel-json)
    - [vercel.ts](https://vercel.com/docs/project-configuration/vercel-ts)
    - [General Settings](https://vercel.com/docs/project-configuration/general-settings)
    - [Project Settings](https://vercel.com/docs/project-configuration/project-settings)
    - [Git Configuration](https://vercel.com/docs/project-configuration/git-configuration)
    - [Git Settings](https://vercel.com/docs/project-configuration/git-settings)
    - [Global Configuration](https://vercel.com/docs/project-configuration/global-configuration)
    - [Security settings](https://vercel.com/docs/project-configuration/security-settings)

  - [Projects](https://vercel.com/docs/projects) Expand menu
    - [Managing projects](https://vercel.com/docs/projects/managing-projects)
    - [Project Dashboard](https://vercel.com/docs/projects/project-dashboard)
    - [Transferring a project](https://vercel.com/docs/projects/transferring-projects)

  - [Domains](https://vercel.com/docs/domains) Expand menu
    - [Working with Domains](https://vercel.com/docs/domains/working-with-domains) Expand menu
      - [Adding a Domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
      - [Adding a Domain to an Environment](https://vercel.com/docs/domains/working-with-domains/add-a-domain-to-environment)
      - [Assigning a Domain to a Git Branch](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch)
      - [Deploying & Redirecting Domains](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting)
      - [Removing a Domain](https://vercel.com/docs/domains/working-with-domains/remove-a-domain)
      - [Renewing a Domain](https://vercel.com/docs/domains/working-with-domains/renew-a-domain)
      - [Transferring Domains](https://vercel.com/docs/domains/working-with-domains/transfer-your-domain)
      - [Viewing & Searching Domains](https://vercel.com/docs/domains/working-with-domains/view-and-search-domains)

    - [Working with DNS](https://vercel.com/docs/domains/working-with-dns)
    - [Managing DNS Records](https://vercel.com/docs/domains/managing-dns-records)
    - [Working with Nameservers](https://vercel.com/docs/domains/working-with-nameservers)
    - [Managing Nameservers](https://vercel.com/docs/domains/managing-nameservers)
    - [Working with SSL](https://vercel.com/docs/domains/working-with-ssl)
    - [Custom SSL Certificates](https://vercel.com/docs/domains/custom-SSL-certificate)
    - [Pre-Generate SSL Certificates](https://vercel.com/docs/domains/pre-generating-ssl-certs)
    - [Supported Domains](https://vercel.com/docs/domains/supported-domains)
    - [Troubleshooting Domains](https://vercel.com/docs/domains/troubleshooting)
    - [Using Domains API](https://vercel.com/docs/domains/registrar-api)

  - [Integrations](https://vercel.com/docs/integrations) Expand menu
    - [Extend Vercel](https://vercel.com/docs/integrations/install-an-integration) Expand menu
      - [Add a Connectable Account](https://vercel.com/docs/integrations/install-an-integration/add-a-connectable-account)
      - [Add a Native Integration](https://vercel.com/docs/integrations/install-an-integration/product-integration)
      - [Agent Tools](https://vercel.com/docs/integrations/install-an-integration/agent-tools)
      - [Permissions and Access](https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference)

    - [Integrate with Vercel](https://vercel.com/docs/integrations/create-integration) Expand menu
      - [Native integration concepts](https://vercel.com/docs/integrations/create-integration/native-integration)
      - [Create a Native Integration](https://vercel.com/docs/integrations/create-integration/marketplace-product)
      - [Deployment integration actions](https://vercel.com/docs/integrations/create-integration/deployment-integration-action)
      - [Native Integration Flows](https://vercel.com/docs/integrations/create-integration/marketplace-flows)
      - [Integration Approval Checklist](https://vercel.com/docs/integrations/create-integration/approval-checklist)
      - [Using Integrations API](https://vercel.com/docs/integrations/create-integration/marketplace-api) Expand menu
        - [Integrations API Reference](https://vercel.com/docs/integrations/create-integration/marketplace-api/reference)
        - [Secrets Rotation](https://vercel.com/docs/integrations/create-integration/marketplace-api/secrets-rotation)

      - [Integration Image Guidelines](https://vercel.com/docs/integrations/create-integration/integration-image-guidelines)
      - [Requirements for listing an Integration](https://vercel.com/docs/integrations/create-integration/submit-integration)
      - [Upgrade an Integration](https://vercel.com/docs/integrations/create-integration/upgrade-integration)

    - [CMS Integrations](https://vercel.com/docs/integrations/cms) Expand menu
      - [Agility CMS](https://vercel.com/docs/integrations/cms/agility-cms)
      - [ButterCMS](https://vercel.com/docs/integrations/cms/butter-cms)
      - [Contentful](https://vercel.com/docs/integrations/cms/contentful)
      - [DatoCMS](https://vercel.com/docs/integrations/cms/dato-cms)
      - [Formspree](https://vercel.com/docs/integrations/cms/formspree)
      - [Makeswift](https://vercel.com/docs/integrations/cms/makeswift)
      - [Sanity](https://vercel.com/docs/integrations/cms/sanity)
      - [Sitecore](https://vercel.com/docs/integrations/cms/sitecore)

    - [Ecommerce Integrations](https://vercel.com/docs/integrations/ecommerce) Expand menu
      - [BigCommerce](https://vercel.com/docs/integrations/ecommerce/bigcommerce)
      - [Shopify](https://vercel.com/docs/integrations/ecommerce/shopify)

    - [Building Integrations with Vercel REST API](https://vercel.com/docs/integrations/vercel-api-integrations)
    - External Platforms Expand menu
      - [Kubernetes](https://vercel.com/docs/integrations/external-platforms/kubernetes)

  - [Dashboard](https://vercel.com/docs/dashboard-features) Expand menu
    - [Navigating the Dashboard](https://vercel.com/docs/dashboard-features/overview)
    - [Support Center](https://vercel.com/docs/dashboard-features/support-center)
    - [Using the Command Menu](https://vercel.com/docs/dashboard-features/command-menu)

  - [Notifications](https://vercel.com/docs/notifications)
  - [Build Output API](https://vercel.com/docs/build-output-api) Expand menu
    - [Build Output Configuration](https://vercel.com/docs/build-output-api/configuration)
    - [Features](https://vercel.com/docs/build-output-api/features)
    - [Vercel Primitives](https://vercel.com/docs/build-output-api/primitives)

  - [Glossary](https://vercel.com/docs/glossary)
  - [Limits](https://vercel.com/docs/limits) Expand menu
    - [Fair use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)

  - [Checks](https://vercel.com/docs/checks) Expand menu
    - [Checks API](https://vercel.com/docs/checks/checks-api)
    - [Checks Reference](https://vercel.com/docs/checks/creating-checks)

- Pricing Expand menu
  - [Plans](https://vercel.com/docs/plans) Expand menu
    - [Hobby Plan](https://vercel.com/docs/plans/hobby)
    - [Pro Plan](https://vercel.com/docs/plans/pro-plan) Expand menu
      - [Pro Plan Trial](https://vercel.com/docs/plans/pro-plan/trials)
      - [Switch to the Pro Plan](https://vercel.com/docs/plans/pro-plan/switching)
      - [Billing FAQ](https://vercel.com/docs/plans/pro-plan/billing)

    - [Enterprise Plan](https://vercel.com/docs/plans/enterprise) Expand menu
      - [Billing FAQ](https://vercel.com/docs/plans/enterprise/billing)
      - [MIUs for AI](https://vercel.com/docs/plans/enterprise/buy-with-miu)

    - [Legacy Pro Plan](https://vercel.com/docs/plans/pro) Expand menu
      - [Billing FAQ](https://vercel.com/docs/plans/pro/billing)

  - [Pricing](https://vercel.com/docs/pricing) Expand menu
    - [Regional Pricing](https://vercel.com/docs/pricing/regional-pricing) Expand menu
      - [Cape Town, South Africa](https://vercel.com/docs/pricing/regional-pricing/cpt1)
      - [Cleveland, USA](https://vercel.com/docs/pricing/regional-pricing/cle1)
      - [Dubai, UAE](https://vercel.com/docs/pricing/regional-pricing/dxb1)
      - [Dublin, Ireland](https://vercel.com/docs/pricing/regional-pricing/dub1)
      - [Frankfurt, Germany](https://vercel.com/docs/pricing/regional-pricing/fra1)
      - [Hong Kong](https://vercel.com/docs/pricing/regional-pricing/hkg1)
      - [London, UK](https://vercel.com/docs/pricing/regional-pricing/lhr1)
      - [Mumbai, India](https://vercel.com/docs/pricing/regional-pricing/bom1)
      - [Osaka, Japan](https://vercel.com/docs/pricing/regional-pricing/kix1)
      - [Paris, France](https://vercel.com/docs/pricing/regional-pricing/cdg1)
      - [Portland, USA](https://vercel.com/docs/pricing/regional-pricing/pdx1)
      - [San Francisco, USA](https://vercel.com/docs/pricing/regional-pricing/sfo1)
      - [São Paulo, Brazil](https://vercel.com/docs/pricing/regional-pricing/gru1)
      - [Seoul, South Korea](https://vercel.com/docs/pricing/regional-pricing/icn1)
      - [Singapore](https://vercel.com/docs/pricing/regional-pricing/sin1)
      - [Stockholm, Sweden](https://vercel.com/docs/pricing/regional-pricing/arn1)
      - [Sydney, Australia](https://vercel.com/docs/pricing/regional-pricing/syd1)
      - [Tokyo, Japan](https://vercel.com/docs/pricing/regional-pricing/hnd1)
      - [Washington, D.C., USA](https://vercel.com/docs/pricing/regional-pricing/iad1)

    - [Manage and Optimize Usage](https://vercel.com/docs/pricing/manage-and-optimize-usage)
    - [Calculating Usage of Resources](https://vercel.com/docs/pricing/how-does-vercel-calculate-usage-of-resources)
    - [Billing & Invoices](https://vercel.com/docs/pricing/understanding-my-invoice)
    - [Legacy Metrics](https://vercel.com/docs/pricing/legacy)
    - [Sales Tax](https://vercel.com/docs/pricing/sales-tax)

  - [Spend Management](https://vercel.com/docs/spend-management)

- Security Expand menu
  - [Overview](https://vercel.com/docs/security) Expand menu
    - [Security & Compliance Measures](https://vercel.com/docs/security/compliance)
    - [Shared Responsibility Model](https://vercel.com/docs/security/shared-responsibility)
    - [PCI DSS iframe Integration](https://vercel.com/docs/security/pci-dss)
    - [Reverse Proxy Servers and Vercel](https://vercel.com/docs/security/reverse-proxy)
    - [Access Control](https://vercel.com/docs/security/access-control)

  - [Audit Logs](https://vercel.com/docs/audit-log)
  - [Firewall](https://vercel.com/docs/vercel-firewall) Expand menu
    - [Firewall Concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts)
    - [DDoS Mitigation](https://vercel.com/docs/vercel-firewall/ddos-mitigation)
    - [Attack Challenge Mode](https://vercel.com/docs/vercel-firewall/attack-challenge-mode)
    - [Web Application Firewall](https://vercel.com/docs/vercel-firewall/vercel-waf) Expand menu
      - [Custom Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
      - [Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
      - [Rule Configuration](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration)
      - [System Bypass Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/system-bypass-rules)
      - [Rate Limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk)
      - [IP Blocking](https://vercel.com/docs/vercel-firewall/vercel-waf/ip-blocking)
      - [Managed Rulesets](https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets)
      - [Examples](https://vercel.com/docs/vercel-firewall/vercel-waf/examples)
      - [Usage & Pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)

    - [Firewall API](https://vercel.com/docs/vercel-firewall/firewall-api)
    - [Firewall Observability](https://vercel.com/docs/vercel-firewall/firewall-observability)

  - [Bot Management](https://vercel.com/docs/bot-management)
  - [BotID](https://vercel.com/docs/botid) Expand menu
    - [Get Started with BotID](https://vercel.com/docs/botid/get-started)
    - [Handling Verified Bots](https://vercel.com/docs/botid/verified-bots)
    - [Advanced BotID Configuration](https://vercel.com/docs/botid/advanced-configuration)
    - [Form Submissions](https://vercel.com/docs/botid/form-submissions)
    - [Local Development Behavior](https://vercel.com/docs/botid/local-development-behavior)

  - [Connectivity](https://vercel.com/docs/connectivity) Expand menu
    - [Secure Compute](https://vercel.com/docs/connectivity/secure-compute)
    - [Static IPs](https://vercel.com/docs/connectivity/static-ips) Expand menu
      - [Getting Started](https://vercel.com/docs/connectivity/static-ips/getting-started)

  - [OIDC](https://vercel.com/docs/oidc) Expand menu
    - [AWS](https://vercel.com/docs/oidc/aws)
    - [Azure](https://vercel.com/docs/oidc/azure)
    - [Connect your API](https://vercel.com/docs/oidc/api)
    - [Google Cloud Platform](https://vercel.com/docs/oidc/gcp)
    - [OIDC Reference](https://vercel.com/docs/oidc/reference)

  - [RBAC](https://vercel.com/docs/rbac) Expand menu
    - [Access Roles](https://vercel.com/docs/rbac/access-roles) Expand menu
      - [Extended Permissions](https://vercel.com/docs/rbac/access-roles/extended-permissions)
      - [Project Level Roles](https://vercel.com/docs/rbac/access-roles/project-level-roles)
      - [Team Level Roles](https://vercel.com/docs/rbac/access-roles/team-level-roles)

    - [Access Groups](https://vercel.com/docs/rbac/access-groups)
    - [Managing Team Members](https://vercel.com/docs/rbac/managing-team-members)

  - [Two-factor Enforcement](https://vercel.com/docs/two-factor-enforcement)

- Storage Expand menu
  - [Overview](https://vercel.com/docs/storage)
  - [Blob](https://vercel.com/docs/vercel-blob) Expand menu
    - [Server Uploads](https://vercel.com/docs/vercel-blob/server-upload)
    - [Client Uploads](https://vercel.com/docs/vercel-blob/client-upload)
    - [Using the SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk)
    - [Pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
    - [Security](https://vercel.com/docs/vercel-blob/security)
    - [Examples](https://vercel.com/docs/vercel-blob/examples)

  - [Edge Config](https://vercel.com/docs/edge-config) Expand menu
    - [Getting Started](https://vercel.com/docs/edge-config/get-started)
    - [Using Edge Config](https://vercel.com/docs/edge-config/using-edge-config)
    - [Edge Configs & REST API](https://vercel.com/docs/edge-config/vercel-api)
    - [Edge Configs & Dashboard](https://vercel.com/docs/edge-config/edge-config-dashboard)
    - [Edge Config SDK](https://vercel.com/docs/edge-config/edge-config-sdk)
    - [Limits & Pricing](https://vercel.com/docs/edge-config/edge-config-limits)
    - [Integrations](https://vercel.com/docs/edge-config/edge-config-integrations) Expand menu
      - [DevCycle](https://vercel.com/docs/edge-config/edge-config-integrations/devcycle-edge-config)
      - [Hypertune](https://vercel.com/docs/edge-config/edge-config-integrations/hypertune-edge-config)
      - [LaunchDarkly](https://vercel.com/docs/edge-config/edge-config-integrations/launchdarkly-edge-config)
      - [Split](https://vercel.com/docs/edge-config/edge-config-integrations/split-edge-config)
      - [Statsig](https://vercel.com/docs/edge-config/edge-config-integrations/statsig-edge-config)

[Functions](https://vercel.com/docs/functions)

[Runtimes](https://vercel.com/docs/functions/runtimes)

Python

# Using the Python Runtime with Vercel Functions

Copy page Ask AI about this page

Last updated November 3, 2025

The Python runtime is available in [Beta](https://vercel.com/docs/release-phases#beta)on[all plans](https://vercel.com/docs/plans)

The Python runtime enables you to write Python code, including using [FastAPI](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/fastapi), [Django](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/django), and [Flask](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/flask), with Vercel Functions.

You can create your first function, available at the route, as follows:

A hello world Python API using Vercel functions.

## [Python version](https://vercel.com/docs/functions/runtimes/python#python-version)

The current available version is Python 3.12. This cannot be changed.

## [Dependencies](https://vercel.com/docs/functions/runtimes/python#dependencies)

You can install dependencies for your Python projects by defining them in a with or without a corresponding , , or a with corresponding .

An example `requirements.txt` file that defines`FastAPI` as a dependency.

An example `pyproject.toml` file that defines`FastAPI` as a dependency.

## [Streaming Python functions](https://vercel.com/docs/functions/runtimes/python#streaming-python-functions)

Vercel Functions support streaming responses when using the Python runtime. This allows you to render parts of the UI as they become ready, letting users interact with your app before the entire page finishes loading.

## [Controlling what gets bundled](https://vercel.com/docs/functions/runtimes/python#controlling-what-gets-bundled)

By default, Python Vercel Functions include all files from your project that are reachable at build time. Unlike the Node.js runtime, there is no automatic tree-shaking to remove dead code or unused dependencies.

You should make sure your or only lists packages necessary for runtime and you should also explicitly exclude files you don't need in your functions to keep bundles small and avoid hitting size limits.

Python functions have a maximum uncompressed bundle size of **250 MB**. See the[bundle size limits](https://vercel.com/docs/functions/limitations#bundle-size-limits).

To exclude unnecessary files (for example: tests, static assets, and test data), configure in under the key. The pattern is a [glob](https://github.com/isaacs/node-glob#glob-primer) relative to your project root.

Exclude common development and static folders from all Python functions to stay under the 250 MB bundle limit.

## [Using FastAPI with Vercel](https://vercel.com/docs/functions/runtimes/python#using-fastapi-with-vercel)

FastAPI is a modern, high-performance, web framework for building APIs with Python. For information on how to use FastAPI with Vercel, review this [guide](https://vercel.com/docs/frameworks/backend/fastapi).

## [Using Flask with Vercel](https://vercel.com/docs/functions/runtimes/python#using-flask-with-vercel)

Flask is a lightweight WSGI web application framework. For information on how to use Flask with Vercel, review this [guide](https://vercel.com/docs/frameworks/backend/flask).

## [Other Python Frameworks](https://vercel.com/docs/functions/runtimes/python#other-python-frameworks)

For FastAPI, Flask, or basic usage of the Python runtime, no configuration is required. Usage of the Python runtime with other frameworks, including Django, requires some configuration.

The entry point of this runtime is a glob matching source files with one of the following variables defined:

- that inherits from the class
- that exposes a WSGI or ASGI Application

### [Reading Relative Files in Python](https://vercel.com/docs/functions/runtimes/python#reading-relative-files-in-python)

Python uses the current working directory when a relative file is passed to [open()](https://docs.python.org/3/library/functions.html#open).

The current working directory is the base of your project, not the directory.

For example, the following directory structure:

With the above directory structure, your function in can read the contents of in a couple different ways.

You can use the path relative to the project's base directory.

Or you can use the path relative to the current file's directory.

### [Web Server Gateway Interface](https://vercel.com/docs/functions/runtimes/python#web-server-gateway-interface)

The Web Server Gateway Interface (WSGI) is a calling convention for web servers to forward requests to web applications written in Python. You can use WSGI with frameworks such as Flask or Django.

- [Deploy an example with Flask](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/flask)
- [Deploy an example with Django](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/python/django)

### [Asynchronous Server Gateway Interface](https://vercel.com/docs/functions/runtimes/python#asynchronous-server-gateway-interface)

The Asynchronous Server Gateway Interface (ASGI) is a calling convention for web servers to forward requests to asynchronous web applications written in Python. You can use ASGI with frameworks such as [Sanic](https://sanic.readthedocs.io/).

Instead of defining a , define an variable in your Python file.

For example, define a file as follows:

An example `api/index.py` file, using Sanic for a ASGI application.

Inside define:

An example `requirements.txt` file, listing`sanic` as a dependency.

---

[Previous Bun](https://vercel.com/docs/functions/runtimes/bun)[Next Rust](https://vercel.com/docs/functions/runtimes/rust)

Was this helpful?

supported.

Send

On this page

- [Python version](https://vercel.com/docs/functions/runtimes/python#python-version)
- [Dependencies](https://vercel.com/docs/functions/runtimes/python#dependencies)
- [Streaming Python functions](https://vercel.com/docs/functions/runtimes/python#streaming-python-functions)
- [Controlling what gets bundled](https://vercel.com/docs/functions/runtimes/python#controlling-what-gets-bundled)
- [Using FastAPI with Vercel](https://vercel.com/docs/functions/runtimes/python#using-fastapi-with-vercel)
- [Using Flask with Vercel](https://vercel.com/docs/functions/runtimes/python#using-flask-with-vercel)
- [Other Python Frameworks](https://vercel.com/docs/functions/runtimes/python#other-python-frameworks)
- [Reading Relative Files in Python](https://vercel.com/docs/functions/runtimes/python#reading-relative-files-in-python)
- [Web Server Gateway Interface](https://vercel.com/docs/functions/runtimes/python#web-server-gateway-interface)
- [Asynchronous Server Gateway Interface](https://vercel.com/docs/functions/runtimes/python#asynchronous-server-gateway-interface)

Copy page Give feedback Ask AI about this page

## Products

- [AI](https://vercel.com/ai)
- [Enterprise](https://vercel.com/enterprise)
- [Fluid Compute](https://vercel.com/fluid)
- [Next.js](https://vercel.com/solutions/nextjs)
- [Observability](https://vercel.com/products/observability)
- [Previews](https://vercel.com/products/previews)
- [Rendering](https://vercel.com/products/rendering)
- [Security](https://vercel.com/security)
- [Turbo](https://vercel.com/solutions/turborepo)
- [Domains](https://vercel.com/domains)
- [Sandbox](https://vercel.com/sandbox)
- [v0](https://v0.app/)

## Resources

- [Community](https://community.vercel.com/)
- [Docs](https://vercel.com/docs)
- [Knowledge Base](https://vercel.com/kb)
- [Academy](https://vercel.com/academy)
- [Help](https://vercel.com/help)
- [Integrations](https://vercel.com/integrations)
- [Platforms](https://vercel.com/platforms)
- [Pricing](https://vercel.com/pricing)
- [Resources](https://vercel.com/resources)
- [Solution Partners](https://vercel.com/partners/solution-partners)
- [Startups](https://vercel.com/startups)
- [Templates](https://vercel.com/templates)
- SDKs by Vercel
  - [AI SDK](https://sdk.vercel.ai/)
  - [Workflow DevKit](https://useworkflow.dev/)
  - [Flags SDK](https://flags-sdk.dev/)
  - [Chat SDK](https://chat-sdk.dev/)
  - [Streamdown AI](https://streamdown.ai/)

## Company

- [About](https://vercel.com/about)
- [Blog](https://vercel.com/blog)
- [Careers](https://vercel.com/careers)
- [Changelog](https://vercel.com/changelog)
- [Contact Us](https://vercel.com/contact)
- [Customers](https://vercel.com/customers)
- [Events](https://vercel.com/events)
- [Partners](https://vercel.com/partners)
- [Shipped](https://vercel.com/shipped)
- [Privacy Policy](https://vercel.com/legal/privacy-policy)
- Legal

## Social

- [GitHub](https://github.com/vercel)
- [LinkedIn](https://linkedin.com/company/vercel)
- [Twitter](https://x.com/vercel)
- [YouTube](https://youtube.com/@VercelHQ)

[](https://vercel.com/home)

[Loading status…](https://vercel-status.com/)Select a display theme:system light dark
