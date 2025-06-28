# JobGrid API

JobGrid API is a backend service built with [Hono](https://hono.dev/), a lightweight web framework for Cloudflare Workers. This API provides authentication and other essential features, leveraging Supabase for database and authentication management.

## Features

- **Cloudflare Workers**: Deployed on the edge for low-latency responses.
- **Supabase Integration**: Handles database and authentication seamlessly.
- **CORS Support**: Configured to allow secure cross-origin requests.
- **PKCE Authentication Flow**: Ensures secure user authentication.

## Prerequisites

Before you begin, ensure you have the following:

- [Node.js](https://nodejs.org/) installed.
- A Cloudflare account with Workers enabled.
- Supabase project credentials.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/jobgrid-api.git
   cd jobgrid-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.dev.vars` file in the root directory (already included in the repository).
   - Update the values in `.dev.vars` with your Supabase and Cloudflare credentials.

## Development

To start the development server locally:

```bash
npm run dev
```

This will run the API on a local Cloudflare Worker environment.

## Deployment

To deploy the API to Cloudflare Workers:

```bash
npm run deploy
```

Ensure you are authenticated with the Cloudflare CLI (`wrangler`) and have the necessary permissions.

## Environment Variables

The following environment variables are required:

- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SECRET_KEY`: Your Supabase service role secret key.
- `AUTH0_DOMAIN`: Your Auth0 domain.
- `AUTH0_CLIENT_ID`: Your Auth0 client ID.
- `AUTH0_CLIENT_SECRET`: Your Auth0 client secret.
- `PRODUCTION`: Whether the environment is production (set to `true` or `false`).
- `COOKIE_SECRET`: Secret used for signing cookies.

## Project Structure

```
jobgrid-api/
├── src/
│   ├── middlewares/       # Custom middleware for Hono
│   ├── routes/            # API route handlers
│   └── index.ts           # Entry point of the application
├── .dev.vars              # Environment variables for development
├── README.md              # Project documentation
└── package.json           # Node.js dependencies and scripts
```

## License

This project is licensed under a **Commercial Software License**. See the [LICENSE.md](LICENSE.md) file for details.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve the project.

---
Built with ❤️ using [Hono](https://hono.dev/) and [Supabase](https://supabase.com/).
