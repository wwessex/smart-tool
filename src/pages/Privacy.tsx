import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Cookie, Lock, Mail, ExternalLink, UserCheck, Globe, Clock, Server, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};

export default function Privacy() {
  const navigate = useNavigate();
  const lastUpdated = "20 February 2026";

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        className="max-w-3xl mx-auto px-4 py-12"
        initial="initial"
        animate="animate"
        variants={{
          animate: { transition: { staggerChildren: 0.1 } }
        }}
      >
        <motion.div variants={fadeIn} className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          </div>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </motion.div>

        <motion.div variants={fadeIn} className="prose prose-neutral dark:prose-invert max-w-none space-y-8">

          {/* Data Controller */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              Data Controller
            </h2>
            <p className="text-muted-foreground mb-4">
              The data controller for the public version of the SMART Action Tool is William Wessex.
              You can contact the data controller at{' '}
              <a href="mailto:contact@williamwessex.com" className="text-primary hover:underline">
                contact@williamwessex.com
              </a>.
            </p>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">
                If your organisation has deployed a customised or internal version of this tool,
                your organisation is the data controller for that deployment. Contact your
                organisation's Data Protection Officer for queries relating to those instances.
              </p>
            </div>
          </section>

          {/* Purposes and Lawful Basis */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Scale className="w-5 h-5 text-primary" />
              Purposes and Lawful Basis for Processing
            </h2>
            <p className="text-muted-foreground mb-4">
              Under UK GDPR Article 6, we process personal data on the following bases:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Processing Activity</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Lawful Basis</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4">Storing action history, templates, barriers, and timescales</td>
                    <td className="py-2 pr-4">Core app functionality</td>
                    <td className="py-2">Legitimate interests &ndash; Art&nbsp;6(1)(f)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Storing participant forenames in action history</td>
                    <td className="py-2 pr-4">Identifying which actions relate to which participant</td>
                    <td className="py-2">Legitimate interests &ndash; Art&nbsp;6(1)(f)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Storing user preferences (theme, AI settings, retention settings)</td>
                    <td className="py-2 pr-4">Remembering your preferences between sessions</td>
                    <td className="py-2">Legitimate interests &ndash; Art&nbsp;6(1)(f)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Local AI model downloads and on-device processing</td>
                    <td className="py-2 pr-4">Providing AI-powered draft suggestions in your browser</td>
                    <td className="py-2">Consent &ndash; Art&nbsp;6(1)(a)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Cloud AI processing (where available)</td>
                    <td className="py-2 pr-4">Optional AI chat and translation via cloud services</td>
                    <td className="py-2">Explicit consent &ndash; Art&nbsp;6(1)(a)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Automatic data retention cleanup</td>
                    <td className="py-2 pr-4">Limiting how long personal data is stored</td>
                    <td className="py-2">Legitimate interests &ndash; Art&nbsp;6(1)(f)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Third-Party Requests and Cloud AI */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Server className="w-5 h-5 text-primary" />
              Third-Party Services and Data Sharing
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Local AI (default)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  By default, all AI drafting and translation runs locally in your browser using on-device models.
                  No action text, participant details, or translations are sent to any external server
                  when using local AI mode.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Cloud AI features (where available)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The tool includes optional cloud AI features for chat-based drafting and translation.
                  These features are consent-gated and only activated if you explicitly opt in.
                  When active, your action text or chat messages are sent through the following processing chain:
                </p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground mt-2 space-y-1">
                  <li>Your browser sends text to a Supabase Edge Function (hosted by Supabase Inc.)</li>
                  <li>The Edge Function forwards the request to Lovable's AI gateway</li>
                  <li>Lovable's gateway routes the request to Google Gemini for AI processing</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  For rate limiting, a hash of your IP address is held in memory for up to 60 seconds,
                  then automatically deleted. Raw IP addresses are not stored or logged.
                  Only the number of messages processed is logged, never the content.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Data processors (cloud AI)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When cloud AI features are used, the following third parties act as data processors:
                </p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground mt-2 space-y-1">
                  <li><strong>Supabase Inc.</strong> &ndash; Edge Function hosting (processes the request)</li>
                  <li><strong>Lovable</strong> &ndash; AI gateway proxy</li>
                  <li><strong>Google</strong> &ndash; Gemini model provider (generates AI responses)</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Model downloads</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If you enable the Local AI Module, your browser may download model files from this website
                  (self-hosted) or from Hugging Face Hub. These downloads are standard HTTP requests that include
                  browser metadata such as your IP address. No action text is transmitted as part of these requests.
                  Downloaded models are cached locally for offline reuse.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">UI assets</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Language badges are rendered as text. No user text is transmitted as part of asset requests.
                </p>
              </div>
            </div>

            <p className="text-muted-foreground mt-4">
              We do not use analytics services, advertising networks, or social media tracking.
            </p>
          </section>

          {/* Local AI Module */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Local AI Module</h2>
            <p className="text-muted-foreground mb-4">
              When you enable the Local AI Module, drafting and translation run locally in your browser.
              Your text is processed on-device and is not sent to any server for AI processing.
            </p>
            <p className="text-sm text-muted-foreground">
              Your browser may download AI model files from this website (self-hosted) or Hugging Face Hub
              when you enable the local AI module. These downloads do not include your action text.
              Model files are cached in browser CacheStorage for offline reuse and can be cleared
              via Settings.
            </p>
          </section>

          {/* International Data Transfers */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Globe className="w-5 h-5 text-primary" />
              International Data Transfers
            </h2>
            <p className="text-muted-foreground mb-4">
              When using the tool in local-only mode (the default), no personal data leaves your device
              or browser. No international transfer occurs.
            </p>
            <p className="text-muted-foreground mb-4">
              When optional cloud AI features are active, data may be transferred to servers outside
              the United Kingdom. Supabase infrastructure may be located in the EU or US. Lovable's
              AI gateway and Google's Gemini service may process data in the US or other jurisdictions.
            </p>
            <p className="text-muted-foreground mb-4">
              Safeguards for these transfers include:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>The UK has an adequacy decision for the EU/EEA, permitting data flows without additional safeguards</li>
              <li>For US and other transfers, services rely on Standard Contractual Clauses (SCCs) and/or the EU-US Data Privacy Framework</li>
              <li>Data processing agreements are in place with cloud service providers</li>
            </ul>
            <div className="mt-4 p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">
                If you are using this tool in a UK public sector or regulated context, check with your
                Data Protection Officer that these transfer mechanisms are acceptable for your use case
                before enabling cloud AI features.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Clock className="w-5 h-5 text-primary" />
              Data Retention
            </h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Action history:</strong> The tool includes configurable automatic data retention.
                The default retention period is <strong>90 days</strong>. You can configure this between
                7 and 365 days, or disable automatic cleanup entirely, in Settings.
              </li>
              <li>
                <strong>Automatic cleanup:</strong> When enabled, retention cleanup runs automatically
                once every 24 hours when the app is opened. Actions older than your configured
                retention period are permanently deleted.
              </li>
              <li>
                <strong>Other stored data:</strong> Templates, barriers, timescales, and preferences
                are retained until you manually delete them or use the "Delete All Data" option in Settings.
              </li>
              <li>
                <strong>Cloud AI processing:</strong> Text sent to cloud AI functions is processed in
                real-time and is not stored by the edge functions. IP hashes used for rate limiting
                are held in memory for up to 60 seconds. The AI gateway and model providers may have
                their own retention policies; refer to their respective privacy policies for details.
              </li>
              <li>
                <strong>Manual deletion:</strong> You can delete all stored data at any time via
                "Delete All Data" in Settings. This clears localStorage, IndexedDB, cached model
                files, and session data.
              </li>
            </ul>
          </section>

          {/* Cookies and Local Storage */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Cookie className="w-5 h-5 text-primary" />
              Cookies and Local Storage
            </h2>
            <p className="text-muted-foreground mb-4">
              We do not use tracking cookies. We use browser storage for essential functionality
              as detailed below.
            </p>

            <h3 className="text-base font-semibold mb-3 mt-6">localStorage</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Storage Key</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.history</td>
                    <td className="py-2 pr-4">Saved SMART actions (may include participant forenames)</td>
                    <td className="py-2">Configurable (default 90 days)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.templates</td>
                    <td className="py-2 pr-4">Custom action templates</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.barriers</td>
                    <td className="py-2 pr-4">Custom barriers list</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.timescales</td>
                    <td className="py-2 pr-4">Custom timescales list</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.recentNames</td>
                    <td className="py-2 pr-4">Recently used participant forenames (max 10)</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.gdprConsent</td>
                    <td className="py-2 pr-4">Your privacy consent record</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.onboardingComplete</td>
                    <td className="py-2 pr-4">Whether you have completed the tutorial</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.retentionDays</td>
                    <td className="py-2 pr-4">Your data retention period setting</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.retentionEnabled</td>
                    <td className="py-2 pr-4">Whether automatic cleanup is enabled</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.lastRetentionCheck</td>
                    <td className="py-2 pr-4">Timestamp of last automatic cleanup</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.minScoreEnabled</td>
                    <td className="py-2 pr-4">Whether minimum SMART score check is enabled</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.minScoreThreshold</td>
                    <td className="py-2 pr-4">Minimum SMART score threshold</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.participantLanguage</td>
                    <td className="py-2 pr-4">Selected translation language</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.aiDraftMode</td>
                    <td className="py-2 pr-4">AI draft or template mode preference</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.preferredLLMModel</td>
                    <td className="py-2 pr-4">Selected local AI model</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.allowMobileLLM</td>
                    <td className="py-2 pr-4">Whether to allow AI on mobile devices</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.safariWebGPUEnabled</td>
                    <td className="py-2 pr-4">Whether Safari WebGPU is enabled</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.keepSafariModelLoaded</td>
                    <td className="py-2 pr-4">Whether to keep AI model loaded in Safari</td>
                    <td className="py-2">Until manually deleted</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.localSync.folderName</td>
                    <td className="py-2 pr-4">Name of selected sync folder</td>
                    <td className="py-2">Until sync disconnected</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.localSync.syncEnabled</td>
                    <td className="py-2 pr-4">Whether folder sync is active</td>
                    <td className="py-2">Until sync disconnected</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.localSync.lastSync</td>
                    <td className="py-2 pr-4">Timestamp of last file sync</td>
                    <td className="py-2">Until sync disconnected</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs">theme</td>
                    <td className="py-2 pr-4">Light/dark mode preference</td>
                    <td className="py-2">Until manually changed</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-semibold mb-3 mt-6">Other Browser Storage</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Mechanism</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4">IndexedDB</td>
                    <td className="py-2 pr-4">Stores file system folder handles for local file sync</td>
                    <td className="py-2">Until sync disconnected</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">CacheStorage</td>
                    <td className="py-2 pr-4">Cached AI model files for offline use</td>
                    <td className="py-2">Until manually cleared</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">sessionStorage</td>
                    <td className="py-2 pr-4">Error diagnostic information (current session only)</td>
                    <td className="py-2">Cleared when tab closes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Cookie</td>
                    <td className="py-2 pr-4">UI layout preference (not currently active)</td>
                    <td className="py-2">7 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Your Rights */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Scale className="w-5 h-5 text-primary" />
              Your Rights Under UK GDPR
            </h2>
            <p className="text-muted-foreground mb-4">
              Under the UK General Data Protection Regulation, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li>
                <strong>Right of access (Article 15):</strong> You can view all your stored data
                at any time within the app. Use the "Export Data" feature in Settings to download a
                complete copy of your data in JSON format.
              </li>
              <li>
                <strong>Right to rectification (Article 16):</strong> You can edit your saved actions,
                templates, barriers, and other data directly within the app at any time.
              </li>
              <li>
                <strong>Right to erasure (Article 17):</strong> You can delete individual actions
                from your history, or use "Delete All Data" in Settings to remove all stored data.
                This clears localStorage, IndexedDB, cached model files, and session data.
              </li>
              <li>
                <strong>Right to restriction of processing (Article 18):</strong> You can disable
                specific features (AI module, automatic retention cleanup, folder sync) individually
                in Settings without deleting your data.
              </li>
              <li>
                <strong>Right to data portability (Article 20):</strong> The "Export Data" feature
                provides all your data in a structured, machine-readable JSON format that can be
                imported into another instance of this tool.
              </li>
              <li>
                <strong>Right to object (Article 21):</strong> As processing is based on legitimate
                interests, you have the right to object. You can stop using the tool and delete your
                data at any time. For cloud AI features, you can withdraw consent by not opting in
                or by disabling the feature.
              </li>
              <li>
                <strong>Automated decision-making (Article 22):</strong> The SMART score and AI
                suggestions are advisory tools only. No automated decisions are made about
                participants. Employment advisors retain full control over all actions.
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise any of these rights, use the in-app features in Settings, or contact
              us at{' '}
              <a href="mailto:contact@williamwessex.com" className="text-primary hover:underline">
                contact@williamwessex.com
              </a>.
            </p>
          </section>

          {/* Security */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Lock className="w-5 h-5 text-primary" />
              Security Measures
            </h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>All data transmission uses HTTPS encryption</li>
              <li>Local data remains on your device only</li>
              <li>No accounts or passwords to protect</li>
              <li>No server-side storage of personal data when using local-only mode</li>
              <li>Cloud AI edge functions do not log or persist user content</li>
              <li>Regular security reviews of the codebase</li>
            </ul>
          </section>

          {/* Children */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Children's Privacy</h2>
            <p className="text-muted-foreground">
              This tool is designed for employment advisors and is not intended for use by individuals
              under 18 years of age. We do not knowingly collect data from children.
            </p>
          </section>

          {/* Complaints */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Complaints</h2>
            <p className="text-muted-foreground mb-4">
              If you have concerns about how your data is being handled, you have the right to
              lodge a complaint with the Information Commissioner's Office (ICO):
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://ico.org.uk/make-a-complaint/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                ico.org.uk/make-a-complaint
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-muted-foreground mt-2">
              Phone: 0303 123 1113
            </p>
          </section>

          {/* Contact */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Mail className="w-5 h-5 text-primary" />
              Contact
            </h2>
            <p className="text-muted-foreground">
              The data controller for the public version of this tool is William Wessex.
              For data protection enquiries, please contact{' '}
              <a href="mailto:contact@williamwessex.com" className="text-primary hover:underline">
                contact@williamwessex.com
              </a>.
              If your organisation has deployed a customised or internal version, contact your
              organisation's data protection officer.
            </p>
          </section>

          {/* Changes */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. The "Last updated" date at the top
              of this page indicates when the policy was last revised. If we make material changes,
              the consent version will be incremented and you will be asked to review and re-accept
              the updated terms. We encourage you to review this policy periodically.
            </p>
          </section>

        </motion.div>
      </motion.div>
    </div>
  );
}
