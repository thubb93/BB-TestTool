# BB-TestTool

Internal QA & testing platform for database management, API testing, and specialized testing tools.

**Status**: Active Development (v0.1.0)
**Deployment**: Vercel
**Tech Stack**: Next.js 16, React 19, TypeScript 5, Tailwind CSS

## Quick Start

### Prerequisites
- Node.js 22.16.0 (via NVM)
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repo-url>
cd bb-test-tool

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
npm run build
npm start
```

## Features

### Database Management
- **Multi-Driver Support**: PostgreSQL, MySQL, MongoDB, MSSQL, SQLite
- **Connection Pooling**: 30-minute idle timeout for efficient resource usage
- **Query Execution**: Write and execute SQL queries directly in browser
- **Environment Configuration**: Auto-seed default database from env vars
- **Connection Testing**: Verify connectivity before saving

### API Testing
- **HTTP Request Builder**: Construct requests with headers and parameters
- **cURL Import**: Paste cURL commands to auto-populate requests
- **Server Proxy**: CORS-free API requests via server-side proxy
- **Response Analysis**: View raw JSON or formatted responses
- **Performance Metrics**: Track request/response timing

### Built-in Tools

#### Collection Card
Testing tool for NFT collection card APIs
- HTTP request builder with cURL import
- Card opening simulation
- Mystery box simulation
- Response time measurement
- Filter panel for API parameters
- Table/JSON response view toggle

**API**: `uat-api-wallet.aiavatar.fun`

#### Buzznet
Batch content generation tool
- CSV-based persona input
- Batch API request execution
- Real-time progress tracking
- Result export functionality

**API**: `uat-ai-api.bluebelt.asia`

### Settings & Configuration
- **Database Connections**: Add, edit, delete database connection profiles
- **API Keys**: Manage and secure API key storage
- **Auto-Save**: All settings automatically persist to localStorage

## Project Structure

```
src/
├── types/index.ts                    # TypeScript interfaces
├── lib/
│   ├── storage.ts                    # localStorage helpers
│   ├── utils.ts                      # Utility functions
│   ├── builtinProjects.ts            # Built-in tools registry
│   ├── curlParser.ts                 # cURL command parser
│   └── dbPool.ts                     # Database connection pool
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Home page
│   ├── settings/page.tsx             # Settings
│   ├── projects/                     # Built-in tools
│   └── api/                          # API routes
└── components/                       # React components
```

See [Codebase Summary](./docs/codebase-summary.md) for detailed structure.

## Configuration

### Environment Variables

Optional environment variables for default database configuration:

```bash
DEFAULT_DB_NAME=<name>
DEFAULT_DB_DRIVER=postgresql|mysql|sqlite|mongodb|mssql
DEFAULT_DB_HOST=<hostname>
DEFAULT_DB_PORT=<port>
DEFAULT_DB_DATABASE=<database>
DEFAULT_DB_USERNAME=<username>
DEFAULT_DB_PASSWORD=<password>
```

When the app loads with empty databases, it seeds the default DB from these variables.

## API Routes

### POST /api/proxy
Server-side HTTP proxy for external API calls

**Request**:
```json
{
  "url": "https://api.example.com/endpoint",
  "method": "GET|POST|PUT|DELETE",
  "headers": { "Authorization": "Bearer token" },
  "params": { "key": "value" }
}
```

### POST /api/db-test
Test database connection

**Request**:
```json
{
  "driver": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "testdb",
  "username": "user",
  "password": "pass"
}
```

### POST /api/db-query
Execute database query

**Request**:
```json
{
  "connectionId": "connection-uuid",
  "query": "SELECT * FROM users WHERE id = $1",
  "params": [123]
}
```

### GET /api/default-db
Fetch default database configuration from environment

## Data Persistence

All app data is stored in browser localStorage:

- `bb_testtool_projects` → Project[]
- `bb_testtool_settings` → AppSettings (databases + API keys)

**No backend database required** for core functionality.

## Security Notes

⚠️ **Current Implementation**:
- Passwords stored plaintext in localStorage
- API keys visible in Settings UI
- No user authentication
- Recommended for internal use only

✅ **Server-Side**:
- Uses server-side proxy to avoid CORS/mixed-content
- Credentials managed by applications (not transmitted)

See [System Architecture](./docs/system-architecture.md#security-architecture) for details.

## Development

### Code Standards

Follow the standards in [Code Standards](./docs/code-standards.md):
- TypeScript strict mode
- React functional components
- Tailwind CSS utilities
- Error handling with try-catch
- localStorage helpers for persistence

### File Organization

- **Components**: PascalCase (`ProjectCard.tsx`)
- **Utilities**: camelCase (`curlParser.ts`)
- **Types**: Centralized in `src/types/index.ts`
- **Constants**: UPPER_SNAKE_CASE (`PROJECTS_KEY`)

### Running Tests

```bash
# Currently manual testing
# Unit test framework planned for Phase 2
npm run lint
```

## Deployment

### Vercel

The app is configured for Vercel deployment:

```bash
# Automatic deployment on git push
# No additional configuration needed

# Set environment variables in Vercel dashboard:
# DEFAULT_DB_NAME, DEFAULT_DB_DRIVER, etc.
```

### Local Deployment

```bash
npm run build
npm start
# Runs on http://localhost:3000
```

## Roadmap

### Phase 1: MVP ✅ Complete
- Database connection management
- Query execution
- API request builder
- Collection Card tool
- Buzznet tool
- Settings & configuration

### Phase 2: Enhanced Features (Q2 2026)
- Query history & favorites
- Advanced filtering
- Export options (CSV, JSON, Excel, PDF)
- Performance optimizations

### Phase 3: Backend Integration (Q3 2026)
- PostgreSQL backend
- User authentication
- Multi-device sync
- Audit logging

### Phase 4: Advanced Features (Q4 2026+)
- Analytics & reporting
- Custom tool builder
- Team workspaces
- Enterprise features

See [Development Roadmap](./docs/project-roadmap.md) for details.

## Documentation

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Features, requirements, success metrics
- **[Codebase Summary](./docs/codebase-summary.md)** — Project structure, LOC counts, key files
- **[Code Standards](./docs/code-standards.md)** — Coding conventions, patterns, best practices
- **[System Architecture](./docs/system-architecture.md)** — Architecture diagram, data flow, API spec
- **[Development Roadmap](./docs/project-roadmap.md)** — Phase timeline, planned features

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Requirements**:
- Modern browser with localStorage support
- ES2020+ JavaScript
- CSS Grid & Flexbox

## Performance

### Metrics
- Initial load: ~2-3 seconds
- API latency: 50-500ms (depends on external API)
- DB connection: 500-1000ms (first), <10ms (pooled)
- localStorage: 5-10 MB max capacity

## Troubleshooting

### localStorage Full
If you see localStorage quota errors:
- Export settings (future feature)
- Clear browser cache
- Use a different browser/profile

### Database Connection Failed
- Check hostname, port, credentials
- Verify database is accessible
- Check firewall/network rules
- Verify database driver support

### API Request Timeout
- Check external API availability
- Verify network connectivity
- Check server-side proxy logs
- Increase timeout (future feature)

## Contributing

To contribute to BB-TestTool:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following [Code Standards](./docs/code-standards.md)
3. Test locally: `npm run dev`
4. Commit with conventional message: `git commit -m "feat: add feature"`
5. Push and create pull request

## License

Internal project - proprietary

## Support

For issues, questions, or feedback:
- Check [Documentation](./docs/)
- Review [FAQ](#faq)
- Contact development team

## FAQ

**Q: Can I use this in production?**
A: Phase 1 is MVP. Recommend Phase 3 (backend + auth) for production use.

**Q: Is my database password secure?**
A: Currently stored plaintext in localStorage. Encryption planned for Phase 2/3.

**Q: Can multiple people use the same instance?**
A: No, Phase 1 is single-user per browser. Authentication planned for Phase 3.

**Q: What happens if I clear browser data?**
A: All settings and projects are lost. Export planned for Phase 2.

**Q: Can I host this on-premises?**
A: Yes, with Docker (Phase 5). Currently Vercel-optimized.

---

**Version**: 0.1.0
**Last Updated**: 2026-03-16
**Maintained By**: Development Team
