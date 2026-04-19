import { useState } from 'react';
import { Shield, FileText, Scale, ChevronRight } from 'lucide-react';

const TABS = [
  { id: 'privacy',  label: 'Privacy Policy',        icon: Shield },
  { id: 'terms',    label: 'Terms of Use',           icon: FileText },
  { id: 'licenses', label: 'Open Source Licenses',  icon: Scale },
];

const APP_VERSION = '1.0.0';
const EFFECTIVE_DATE = 'April 18, 2025';

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="text-xs text-gray-400 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
        <p className="text-xs text-emerald-400 font-medium">
          Cloudable does not collect, transmit, or store any of your data on external servers.
          Everything stays on your machine.
        </p>
      </div>

      <Section title="1. What We Collect">
        <p>
          Cloudable does not collect any personal data. The application operates entirely on your
          local machine and communicates only with AWS APIs using credentials you provide.
        </p>
        <p>No analytics, telemetry, crash reports, or usage data is sent anywhere by Cloudable.</p>
      </Section>

      <Section title="2. AWS Credentials">
        <p>
          Your AWS Access Key ID and Secret Access Key are stored locally using your operating
          system's native credential storage:
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li><span className="text-white">macOS</span> — macOS Keychain via Electron safeStorage</li>
          <li><span className="text-white">Windows</span> — Windows Data Protection API (DPAPI)</li>
          <li><span className="text-white">Linux</span> — Secret Service (libsecret)</li>
        </ul>
        <p>
          Credentials are never written in plaintext to disk, never sent to Cloudable servers
          (there are none), and never included in any log files.
        </p>
      </Section>

      <Section title="3. AWS API Calls">
        <p>
          All AWS API calls are made directly from your machine to AWS endpoints. Cloudable acts
          as a local client — your data flows between your computer and AWS only. The APIs used
          are read-only (Cost Explorer, EC2 Describe*, RDS Describe*, S3 List*, CloudWatch
          GetMetricData, etc.). No write or delete operations are performed.
        </p>
      </Section>

      <Section title="4. Local Data Storage">
        <p>
          Cloudable stores the following data locally on your machine using electron-store:
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Encrypted AWS credentials (see Section 2)</li>
          <li>Your preferred default region</li>
          <li>Additional account profiles you configure</li>
        </ul>
        <p>
          This data is stored in your OS application data directory and can be cleared at any
          time from Settings → Clear Credentials.
        </p>
      </Section>

      <Section title="5. Third-Party Services">
        <p>
          Cloudable communicates with no third-party services other than AWS. There are no
          advertising networks, analytics platforms, or external APIs involved.
        </p>
      </Section>

      <Section title="6. Children's Privacy">
        <p>
          Cloudable is a professional infrastructure tool not intended for use by persons under
          18 years of age.
        </p>
      </Section>

      <Section title="7. Changes to This Policy">
        <p>
          Any changes to this Privacy Policy will be reflected in updated application releases.
          The effective date at the top of this document will be updated accordingly.
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          For privacy-related questions, contact us at{' '}
          <span className="text-red-400">contact@mowzlisre.me</span>.
        </p>
      </Section>
    </div>
  );
}

function TermsOfUse() {
  return (
    <div className="space-y-6">
      <Section title="1. Acceptance of Terms">
        <p>
          By installing or using Cloudable, you agree to these Terms of Use. If you do not agree,
          do not install or use the application.
        </p>
      </Section>

      <Section title="2. License Grant">
        <p>
          Cloudable grants you a personal, non-exclusive, non-transferable, revocable license to
          use this application solely for your own internal business or personal purposes to
          monitor and analyze your AWS infrastructure costs.
        </p>
      </Section>

      <Section title="3. Permitted Use">
        <ul className="list-disc pl-4 space-y-1">
          <li>Monitor AWS costs and resource usage for accounts you own or are authorized to access</li>
          <li>Export cost and topology data for internal reporting purposes</li>
          <li>Configure multiple AWS account profiles that you are authorized to use</li>
        </ul>
      </Section>

      <Section title="4. Prohibited Use">
        <ul className="list-disc pl-4 space-y-1">
          <li>Using the application to access AWS accounts you are not authorized to access</li>
          <li>Reverse engineering, decompiling, or modifying the application</li>
          <li>Redistributing or reselling the application</li>
          <li>Using the application in a manner that violates AWS's Terms of Service</li>
        </ul>
      </Section>

      <Section title="5. AWS Credentials & Security">
        <p>
          You are solely responsible for the security of the AWS credentials you configure in
          Cloudable. Use IAM users or roles with the minimum permissions required (read-only
          policy provided in Settings). Do not configure credentials with write or admin
          permissions unless strictly necessary for your use case.
        </p>
        <p>
          Cloudable strongly recommends using credentials with the provided minimal read-only IAM
          policy. We are not liable for any unauthorized AWS charges resulting from compromised
          credentials stored on your machine.
        </p>
      </Section>

      <Section title="6. Disclaimer of Warranties">
        <p>
          Cloudable is provided "as is" without warranty of any kind. We do not warrant that the
          application will be error-free, that cost data displayed will match your AWS billing
          statements exactly, or that the application will meet your specific requirements.
        </p>
        <p>
          Cost data is sourced from the AWS Cost Explorer API. Always verify significant cost
          decisions against your official AWS Billing console.
        </p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Cloudable and its developers shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages, including
          loss of revenue, data, or business opportunities arising from your use of the
          application.
        </p>
      </Section>

      <Section title="8. AWS Relationship">
        <p>
          Cloudable is an independent application and is not affiliated with, endorsed by, or
          sponsored by Amazon Web Services, Inc. "AWS", "Amazon Web Services", and related marks
          are trademarks of Amazon.com, Inc. or its affiliates.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          We reserve the right to modify these terms at any time. Continued use of the application
          after changes constitutes acceptance of the revised terms.
        </p>
      </Section>

      <Section title="10. Governing Law">
        <p>
          These terms are governed by applicable law. Any disputes shall be resolved through
          good-faith negotiation before resorting to legal action.
        </p>
      </Section>
    </div>
  );
}

const OSS_LICENSES = [
  { name: 'React',               license: 'MIT',     url: 'https://github.com/facebook/react' },
  { name: 'Electron',            license: 'MIT',     url: 'https://github.com/electron/electron' },
  { name: 'Vite',                license: 'MIT',     url: 'https://github.com/vitejs/vite' },
  { name: 'TanStack Query',      license: 'MIT',     url: 'https://github.com/TanStack/query' },
  { name: 'React Router',        license: 'MIT',     url: 'https://github.com/remix-run/react-router' },
  { name: 'Tailwind CSS',        license: 'MIT',     url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'ReactFlow',           license: 'MIT',     url: 'https://github.com/xyflow/xyflow' },
  { name: 'Lucide React',        license: 'ISC',     url: 'https://github.com/lucide-icons/lucide' },
  { name: 'Express',             license: 'MIT',     url: 'https://github.com/expressjs/express' },
  { name: 'electron-store',      license: 'MIT',     url: 'https://github.com/sindresorhus/electron-store' },
  { name: 'AWS SDK v3',          license: 'Apache 2.0', url: 'https://github.com/aws/aws-sdk-js-v3' },
  { name: 'Recharts',            license: 'MIT',     url: 'https://github.com/recharts/recharts' },
  { name: 'electron-builder',    license: 'MIT',     url: 'https://github.com/electron-userland/electron-builder' },
];

function OpenSourceLicenses() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Cloudable is built on top of the following open source projects. We are grateful to
        their maintainers and contributors.
      </p>
      <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
        {OSS_LICENSES.map((lib, i) => (
          <div
            key={lib.name}
            className={`flex items-center justify-between px-4 py-3 text-xs ${
              i < OSS_LICENSES.length - 1 ? 'border-b border-[#111]' : ''
            }`}
          >
            <span className="text-gray-300 font-medium">{lib.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#1a1a1a] text-gray-500 font-mono">
                {lib.license}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Legal() {
  const [active, setActive] = useState('privacy');

  const content = {
    privacy: <PrivacyPolicy />,
    terms: <TermsOfUse />,
    licenses: <OpenSourceLicenses />,
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Legal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Privacy Policy, Terms of Use, and Open Source Licenses — effective {EFFECTIVE_DATE}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#1a1a1a]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
              active === tab.id
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pb-8">
        {content[active]}
      </div>
    </div>
  );
}
