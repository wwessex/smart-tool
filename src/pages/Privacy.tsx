import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Cookie, Database, Lock, FileText, Mail, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};

export default function Privacy() {
  const navigate = useNavigate();
  const lastUpdated = "17 January 2026";

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
          
          {/* Introduction */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <FileText className="w-5 h-5 text-primary" />
              Introduction
            </h2>
            <p className="text-muted-foreground">
              This Privacy Policy explains how the SMART Action Tool ("we", "our", "the tool") collects, 
              uses, and protects your personal data in accordance with the UK General Data Protection 
              Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
            <p className="text-muted-foreground mt-3">
              We are committed to protecting your privacy and ensuring you understand how your data is handled.
            </p>
          </section>

          {/* Data Controller */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Data Controller</h2>
            <p className="text-muted-foreground mb-4">
              The data controller responsible for your personal data is:
            </p>
            
            <div className="p-4 rounded-lg bg-muted/30 space-y-2">
              <p className="font-medium">William Wessex</p>
              <p className="text-sm text-muted-foreground">
                Developer and operator of SMART Action Tool
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a 
                  href="mailto:contact@williamwessex.com" 
                  className="text-primary hover:underline"
                >
                  contact@williamwessex.com
                </a>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> If you are using this tool as part of an employment support service 
                or within your organisation, that organisation may be the data controller for your use. 
                Contact your organisation's data protection officer for specific enquiries.
              </p>
            </div>
          </section>

          {/* What Data We Collect */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Database className="w-5 h-5 text-primary" />
              What Data We Collect
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Data Stored Locally on Your Device</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Participant forenames (first names only)</li>
                  <li>SMART action text and history</li>
                  <li>Custom barriers and timescales lists</li>
                  <li>Action templates you create</li>
                  <li>Your preferences and settings</li>
                  <li>Consent preferences</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  This data never leaves your device unless you explicitly export it.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Data Processed by AI Service (with consent)</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Action text when using AI improvement features</li>
                  <li>Action text when using translation features (same AI service)</li>
                  <li>Context about barriers and outcomes (no surnames or addresses)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  AI processing (including translation) only occurs when you explicitly use these features and have given consent. 
                  Data is not stored by the AI service and is not used for training AI models.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Data We Do NOT Collect</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Full names, surnames, or addresses</li>
                  <li>National Insurance numbers or other identifiers</li>
                  <li>Account or login information (no accounts required)</li>
                  <li>Browsing history or tracking cookies</li>
                  <li>Analytics data (no third-party analytics)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Purpose and Legal Basis */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Purpose and Legal Basis</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 pr-4 font-medium">Data Used</th>
                    <th className="text-left py-2 font-medium">Legal Basis</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-3 pr-4">Creating SMART actions</td>
                    <td className="py-3 pr-4">Forenames, barriers, actions</td>
                    <td className="py-3">Legitimate interest</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 pr-4">Saving action history</td>
                    <td className="py-3 pr-4">Action text, dates</td>
                    <td className="py-3">Legitimate interest</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 pr-4">AI-powered improvements</td>
                    <td className="py-3 pr-4">Action text, context</td>
                    <td className="py-3">Explicit consent</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Remembering preferences</td>
                    <td className="py-3 pr-4">Settings, theme</td>
                    <td className="py-3">Legitimate interest</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Data Retention */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Data Retention</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Local storage:</strong> Data is stored on your device. You can delete all data 
                at any time from Settings → Privacy & Data.
              </li>
              <li>
                <strong>Automatic cleanup:</strong> By default, action history older than 90 days is 
                automatically deleted when you open the app. You can adjust this period (30, 60, 90, 180, 
                or 365 days) or disable automatic cleanup entirely in Settings → Privacy & Data.
              </li>
              <li>
                <strong>AI processing:</strong> Text sent to AI services is processed in real-time only. 
                We do not intentionally store prompts or responses beyond what is needed for delivery; 
                provider data handling is governed by their applicable terms.
              </li>
              <li>
                <strong>Rate limiting:</strong> To prevent abuse of AI services, we temporarily hash 
                your IP address for rate limiting purposes. The hash expires after 60 seconds, raw IP 
                addresses are never stored, and the hash cannot be reversed. This processing is based 
                on legitimate interest under GDPR Article 6(1)(f).
              </li>
              <li>
                <strong>Server/hosting logs:</strong> Our hosting infrastructure may retain 
                server access logs including IP addresses, user agents, and timestamps for up to 30 days 
                for security and operational purposes. IP addresses are considered online identifiers 
                under GDPR.
              </li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Lock className="w-5 h-5 text-primary" />
              Your Rights Under UK GDPR
            </h2>
            <p className="text-muted-foreground mb-4">
              You have the following rights regarding your personal data:
            </p>
            
            <div className="grid gap-3">
              {[
                { right: "Right to Access", desc: "Export all your stored data from Settings → Privacy & Data" },
                { right: "Right to Rectification", desc: "Edit any action in your history at any time" },
                { right: "Right to Erasure", desc: "Delete all your data with one click in Settings" },
                { right: "Right to Data Portability", desc: "Export your data in JSON format for use elsewhere" },
                { right: "Right to Object", desc: "Disable AI processing in your privacy preferences" },
                { right: "Right to Withdraw Consent", desc: "Change your consent preferences at any time in Settings" },
              ].map((item) => (
                <div key={item.right} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                  <span className="font-medium shrink-0">{item.right}:</span>
                  <span className="text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* How to Exercise Your Rights */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">How to Exercise Your Rights</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
              <li>Open the <strong>Settings</strong> menu in the app</li>
              <li>Navigate to the <strong>Privacy & Data</strong> section</li>
              <li>Use the available options to:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Export all your data (JSON download)</li>
                  <li>Delete all your data</li>
                  <li>Manage your consent preferences</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* Third Parties */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">
              When you use AI features (with your consent), data is processed by the following services:
            </p>
            
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Supabase (Data Processor)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Our backend infrastructure provider. Supabase Edge Functions handle AI and translation 
                  requests. Data is transmitted over HTTPS and processed in the region configured for our 
                  project; international transfers may occur with appropriate safeguards.
                </p>
                <a 
                  href="https://supabase.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  Supabase Privacy Policy
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Google AI (Sub-processor via Lovable AI Gateway)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI model provider (Google Gemini models) accessed via Lovable's AI Gateway. 
                  Text is sent for real-time processing only; we do not intentionally store prompts 
                  or responses beyond what is needed for delivery. Provider data handling is governed 
                  by their applicable terms.
                </p>
                <a 
                  href="https://cloud.google.com/terms/data-processing-addendum" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  Google Cloud Data Processing Terms
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <p className="text-muted-foreground mt-4">
              We do not use analytics services, advertising networks, or social media tracking.
            </p>
          </section>

          {/* Experimental Local AI */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Experimental Local AI Feature</h2>
            <p className="text-muted-foreground mb-4">
              When you enable the experimental "Local AI" feature, your browser may download AI model 
              files from third-party sources:
            </p>
            
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
              <li><strong>Hugging Face</strong> (huggingface.co) - AI model hosting</li>
              <li><strong>GitHub</strong> (raw.githubusercontent.com) - Model configuration files</li>
              <li><strong>WebGPU Report</strong> (webgpureport.org) - Browser capability detection</li>
            </ul>
            
            <p className="text-sm text-muted-foreground mt-3">
              These requests share your IP address and browser metadata with these services. 
              Local AI runs entirely in your browser after download—no action text is sent externally.
            </p>
            
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Note:</strong> Local AI is disabled by default. Downloads only occur when you 
                explicitly enable this feature in Settings.
              </p>
            </div>
          </section>

          {/* Security */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Shield className="w-5 h-5 text-primary" />
              Security Measures
            </h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>All data transmission uses HTTPS encryption</li>
              <li>Local data remains on your device only</li>
              <li>No accounts or passwords to protect</li>
              <li>No server-side storage of personal data</li>
              <li>Regular security reviews of the codebase</li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Cookie className="w-5 h-5 text-primary" />
              Cookies and Local Storage
            </h2>
            <p className="text-muted-foreground mb-4">
              We do not use tracking cookies. We use browser localStorage for essential functionality:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Storage Key</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.history</td>
                    <td className="py-2 pr-4">Saved actions</td>
                    <td className="py-2">Essential</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.gdprConsent</td>
                    <td className="py-2 pr-4">Your privacy preferences</td>
                    <td className="py-2">Essential</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">smartTool.barriers</td>
                    <td className="py-2 pr-4">Custom barriers list</td>
                    <td className="py-2">Essential</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs">theme</td>
                    <td className="py-2 pr-4">Light/dark mode preference</td>
                    <td className="py-2">Essential</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
              For data protection enquiries about this public version of the tool, please contact 
              William Wessex at{' '}
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
              of this page indicates when the policy was last revised. We encourage you to review 
              this policy periodically.
            </p>
          </section>

        </motion.div>
      </motion.div>
    </div>
  );
}
