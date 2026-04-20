# Cloudable

A desktop application for AWS cost intelligence and infrastructure visibility. Understand your cloud spending, identify waste, and optimize your AWS infrastructure — all from a native app that keeps your credentials local.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/electron-31-blue)
![License](https://img.shields.io/badge/license-proprietary-red)

---

## Features

- **Cost Explorer** — Month-to-date spend, daily trends, service breakdowns, and month-end forecasts
- **Infrastructure Mapper** — Interactive visual topology of your entire AWS account: VPCs, EC2, RDS, Lambda, ECS, load balancers, and 30+ other resource types with their relationships
- **Hygiene Score** — Identifies wasted resources (unattached EBS volumes, idle Elastic IPs, stopped instances), underutilized assets, and security hygiene issues with prioritized cleanup suggestions
- **Rightsizing** — EC2 and RDS instance recommendations with estimated cost delta
- **Hidden Charges** — Surfaces obscure cost sources (NAT gateway data transfer, snapshot accumulation, orphaned resources) before they become billing surprises
- **Invoice Preview** — Line-item monthly invoice with cost by service and projected totals
- **Multi-Account** — AWS Organizations support for cross-account visibility
- **Profile Switcher** — Manage multiple AWS credential profiles and switch between them instantly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 31 |
| Frontend | React 18, Vite, Tailwind CSS, React Router, TanStack Query |
| Charts | Recharts |
| Infrastructure map | ReactFlow, Dagre |
| Backend API | Express (embedded, runs on localhost:3001) |
| AWS SDK | AWS SDK v3 (20+ service clients) |
| Packaging | electron-forge (ZIP / Squirrel / .deb) |

---

## Security Model

Credentials are **never** sent to the renderer process. The flow is:

1. User enters AWS credentials in the Settings page
2. Electron main process encrypts and stores them using the OS keychain (`safeStorage`)
3. On startup, Electron injects credentials into `process.env` for the embedded Express server
4. The renderer only calls `http://localhost:3001/api/*` — it never sees the raw keys

Context isolation is enabled and Node integration is disabled in the renderer. The preload script exposes only explicit, named IPC methods via `contextBridge`.

---

## Prerequisites

- Node.js 18+
- An AWS IAM user or role with read-only permissions (see [Required IAM Policy](#required-iam-policy))

---

## Getting Started

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start in development mode (Vite dev server + Electron)
npm run dev
```

The Vite dev server starts on `:5173` and Electron waits for it before opening the window. The embedded Express API runs on `:3001`.

---

## Building

```bash
# Build frontend only
npm run build:frontend

# Package for the current platform
npm run make

# Platform-specific builds (cross-compilation not supported)
npm run make:mac      # macOS → out/make/zip/darwin/*.zip
npm run make:win      # Windows → out/make/squirrel.windows/*.exe
npm run make:linux    # Linux → out/make/deb/**/*.deb
```

### macOS builds require `icon.icns`

The icon must be converted from PNG before packaging. The CI workflow handles this automatically via `sips` + `iconutil`. For local builds on macOS:

```bash
mkdir -p electron/assets/icon.iconset
for size in 16 32 64 128 256 512 1024; do
  sips -z $size $size electron/assets/icon.png \
    --out electron/assets/icon.iconset/icon_${size}x${size}.png
done
cp electron/assets/icon.iconset/icon_32x32.png   electron/assets/icon.iconset/icon_16x16@2x.png
cp electron/assets/icon.iconset/icon_64x64.png   electron/assets/icon.iconset/icon_32x32@2x.png
cp electron/assets/icon.iconset/icon_256x256.png electron/assets/icon.iconset/icon_128x128@2x.png
cp electron/assets/icon.iconset/icon_512x512.png electron/assets/icon.iconset/icon_256x256@2x.png
cp electron/assets/icon.iconset/icon_1024x1024.png electron/assets/icon.iconset/icon_512x512@2x.png
iconutil -c icns electron/assets/icon.iconset -o electron/assets/icon.icns
```

---

## CI / CD

GitHub Actions builds all four targets on every push to `main` and on version tags (`v*`).

| Job | Runner | Output |
|---|---|---|
| `build-mac-arm64` | `macos-latest` | `Cloudable-mac-arm64.zip` |
| `build-mac-x64` | `macos-latest` | `Cloudable-mac-x64.zip` |
| `build-win` | `windows-latest` | `Cloudable-Setup.exe` |
| `build-linux` | `ubuntu-latest` | `cloudable_*.deb` |

Artifacts are uploaded for 30 days. On `v*` tags, a GitHub Release is created automatically with all four artifacts attached.

---

## Project Structure

```
aws-analytica/
├── electron/
│   ├── main.js          # App entry, embedded Express server, credential IPC
│   ├── preload.js       # contextBridge — IPC surface exposed to renderer
│   └── assets/          # App icons
├── backend/
│   ├── server.js        # Express app and route mounting
│   ├── routes/          # One file per API domain (mapper, hygiene, costs, …)
│   └── lib/
│       └── credentials.js
├── frontend/
│   ├── src/
│   │   ├── pages/       # One component per route
│   │   ├── components/  # Shared UI (Layout, StatCard, MapCanvas, …)
│   │   ├── api/         # Fetch wrapper
│   │   └── context/     # RegionContext
│   └── dist/            # Built output (git-ignored, generated at build time)
├── forge.config.js      # Electron Forge — makers and packager config
└── .github/workflows/
    └── build.yml        # CI build matrix
```

---

## API Reference

All endpoints are served by the embedded Express server on `localhost:3001`.

| Endpoint | Description |
|---|---|
| `GET /api/health` | Verify credentials (STS GetCallerIdentity) |
| `GET /api/costs` | MTD cost by service, 90-day history, forecast |
| `GET /api/costs/daily-by-service` | Daily costs for the top 8 services |
| `GET /api/services` | Service list with status and trend indicators |
| `GET /api/invoice` | Monthly invoice line items |
| `GET /api/hidden` | Hidden/wasted resource costs |
| `GET /api/hygiene` | Hygiene score and cleanup recommendations |
| `GET /api/rightsizing` | EC2 / RDS rightsizing suggestions |
| `GET /api/mapper` | Full infrastructure topology (all resource types) |
| `GET /api/ec2` | EC2 instance metrics |
| `GET /api/rds` | RDS instance analysis |
| `GET /api/s3` | S3 bucket analysis |
| `GET /api/aggregate` | Multi-region aggregation |
| `GET /api/organizations` | AWS Organizations account list |

All endpoints accept an optional `?region=` query parameter. Defaults to the region saved in credentials settings.

---

## Required IAM Policy

Cloudable only needs **read-only** access. Attach the following policy to your IAM user or role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast",
        "sts:GetCallerIdentity",
        "ec2:Describe*",
        "ecs:List*",
        "ecs:Describe*",
        "lambda:List*",
        "lambda:GetFunction",
        "rds:Describe*",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketLifecycleConfiguration",
        "s3:GetBucketNotification",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "elasticache:Describe*",
        "es:ListDomainNames",
        "es:DescribeElasticsearchDomains",
        "elasticloadbalancing:Describe*",
        "cloudfront:ListDistributions",
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets",
        "apigateway:GET",
        "sqs:ListQueues",
        "sqs:GetQueueAttributes",
        "sns:ListTopics",
        "events:ListRules",
        "kafka:ListClusters",
        "kinesis:ListStreams",
        "redshift:DescribeClusters",
        "states:ListStateMachines",
        "wafv2:ListWebACLs",
        "ecr:DescribeRepositories",
        "efs:DescribeFileSystems",
        "iam:ListRoles",
        "iam:GetRole",
        "logs:DescribeLogGroups",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "organizations:ListAccounts",
        "organizations:DescribeOrganization"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## macOS — "damaged and can't be opened"

This happens because the app is ad-hoc signed but not notarized by Apple. macOS quarantines apps downloaded from the internet that aren't notarized.

**Workaround — remove the quarantine attribute:**

```bash
xattr -cr /Applications/Cloudable.app
```

Then open it normally. This is safe — it just tells macOS you trust this specific app.

**Why not notarized?** Notarization requires an Apple Developer Program membership ($99/year). If you build from source locally (`npm run make:mac`), the quarantine attribute is never set and the app opens without issue.

---

## Known Limitations

- **Hardcoded pricing**: EC2 and RDS cost estimates use baked-in US East 1 on-demand Linux pricing. Savings Plans, Reserved Instances, and Spot are not reflected.
- **Pagination caps**: Some endpoints cap results (e.g. 100 IAM roles, 50 log groups) to limit API call volume.
- **Cost Explorer scope**: Cost data is account-wide and not per-region. Region filtering applies to live resource queries only.
- **Cross-compilation**: Platform-specific builds must run on the target OS (macOS runner for `.app`, Windows runner for `.exe`).

---

## License

See [LICENSE.txt](LICENSE.txt).
