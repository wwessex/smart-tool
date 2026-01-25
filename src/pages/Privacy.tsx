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
            <h2 className="text-xl font-semibold mb-4">Third‑party requests</h2>
            <p className="text-muted-foreground mb-4">
              This app is designed to run fully in your browser. We do <strong>not</strong> send your action text,
              participant details, or translations to any cloud AI provider.
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">Model downloads (optional)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If you enable the Local AI Module, your browser may download model files from third‑party model hosting
              Your browser may download AI model files from this website (self-hosted) when you enable the local AI module.
                  metadata such as your IP address.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">UI assets</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Language flags may load from a public flag image CDN to ensure consistent rendering on Windows.
                  No user text is transmitted as part of these requests.
                </p>
              </div>
            </div>

            <p className="text-muted-foreground mt-4">
              We do not use analytics services, advertising networks, or social media tracking.
            </p>
          </section>

          {/* Experimental Local AI */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Local AI Module</h2>
            <p className="text-muted-foreground mb-4">
              When you enable the Local AI Module, drafting and translation run locally in your browser.
              Your text is processed on-device and is not sent to a server for AI processing.
            </p>

            <p className="text-sm text-muted-foreground">
              Your browser may download AI model files from this website (self-hosted) when you enable the local AI module.
              These downloads do not include your action text.
            </p>
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