import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Scale, AlertTriangle, Shield, Users, Gavel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};

export default function Terms() {
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
            <Scale className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          </div>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </motion.div>

        <motion.div variants={fadeIn} className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          
          {/* Introduction */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <FileText className="w-5 h-5 text-primary" />
              Agreement to Terms
            </h2>
            <p className="text-muted-foreground">
              By accessing or using the SMART Action Tool ("the Tool", "Service"), you agree to be bound 
              by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may 
              not access the Service.
            </p>
            <p className="text-muted-foreground mt-3">
              These Terms apply to all users, including employment advisors, work coaches, and any 
              other individuals using the Tool for creating SMART actions.
            </p>
          </section>

          {/* Description of Service */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Description of Service</h2>
            <p className="text-muted-foreground mb-4">
              The SMART Action Tool is a productivity application designed to help employment advisors 
              create Specific, Measurable, Achievable, Relevant, and Time-bound (SMART) actions for 
              participants in employment support programmes.
            </p>
            <p className="text-muted-foreground">
              The Service includes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Action creation and editing tools</li>
              <li>SMART quality checking and validation</li>
              <li>Local AI-powered suggestions and improvements (runs in your browser)</li>
              <li>Local storage of action history and templates</li>
              <li>Data export and management features</li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Users className="w-5 h-5 text-primary" />
              Acceptable Use
            </h2>
            <p className="text-muted-foreground mb-4">
              You agree to use the Tool only for lawful purposes and in accordance with these Terms. 
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                Use the Tool in any way that violates applicable laws or regulations, including 
                data protection laws
              </li>
              <li>
                Enter sensitive personal data beyond what is necessary for action creation 
                (e.g., do not enter National Insurance numbers, addresses, or full names)
              </li>
              <li>
                Attempt to gain unauthorised access to the Tool or its systems
              </li>
              <li>
                Use the Tool to generate content that is discriminatory, harassing, or harmful
              </li>
              <li>
                Interfere with or disrupt the Tool's functionality
              </li>
              <li>
                Use automated systems or software to extract data from the Tool
              </li>
            </ul>
          </section>

          {/* Data Minimisation */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Shield className="w-5 h-5 text-primary" />
              Data Minimisation
            </h2>
            <p className="text-muted-foreground mb-4">
              In accordance with UK GDPR principles, you agree to practice data minimisation when using the Tool:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Use forenames only:</strong> Enter only the participant's first name, not their 
                full name or surname
              </li>
              <li>
                <strong>Avoid sensitive data:</strong> Do not enter medical details, financial information, 
                or other sensitive personal data unless strictly necessary
              </li>
              <li>
                <strong>Keep it relevant:</strong> Only include information directly relevant to the 
                SMART action being created
              </li>
              <li>
                <strong>Regular cleanup:</strong> Use the data retention features to automatically remove 
                old actions
              </li>
            </ul>
          </section>

          {/* AI Features */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Local AI Features</h2>
            <p className="text-muted-foreground mb-4">
              The Tool includes an optional Local AI Module that runs entirely in your browser.
              No action text, participant details, or other content is sent to any external server
              for AI processing. By using these features, you acknowledge that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                AI processing happens on your device using browser-based models — your data stays local
              </li>
              <li>
                Your browser may download AI model files when you enable the Local AI Module
              </li>
              <li>
                AI suggestions are provided as guidance only and should be reviewed before use
              </li>
              <li>
                You remain responsible for the accuracy and appropriateness of all actions
              </li>
              <li>
                AI-generated content may not always be accurate or suitable for your specific context
              </li>
              <li>
                Performance depends on your device's hardware capabilities (WebGPU or WASM support)
              </li>
            </ul>
            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> The Local AI Module is optional and can be enabled or disabled
                in your preferences. No cloud AI services are used.
              </p>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Disclaimer
            </h2>
            <p className="text-muted-foreground mb-4">
              The Tool is provided on an "as is" and "as available" basis. We make no warranties, 
              expressed or implied, regarding:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>The accuracy, reliability, or completeness of the Tool's output</li>
              <li>The suitability of generated actions for any particular purpose</li>
              <li>Uninterrupted or error-free operation of the Service</li>
              <li>The accuracy of locally generated AI suggestions</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You are solely responsible for reviewing and validating all SMART actions before using 
              them in professional settings.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by applicable law, in no event shall the Tool's operators 
              be liable for any indirect, incidental, special, consequential, or punitive damages, 
              including without limitation:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-3">
              <li>Loss of data stored locally in the Tool</li>
              <li>Outcomes resulting from use of generated SMART actions</li>
              <li>Professional decisions made based on the Tool's output</li>
              <li>Service interruptions or unavailability</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              The Tool and its original content, features, and functionality are owned by the service 
              operator and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-muted-foreground">
              Actions you create using the Tool remain your property, and you retain all rights to 
              the content you generate.
            </p>
          </section>

          {/* User Content */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Your Content</h2>
            <p className="text-muted-foreground mb-4">
              You are responsible for the content you create using the Tool. By using the Service, you represent that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>You have the right to enter any personal data you include in actions</li>
              <li>The content you create complies with applicable employment and data protection laws</li>
              <li>Actions you create are appropriate for their intended use</li>
            </ul>
          </section>

          {/* Termination */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to terminate or suspend access to the Service immediately, without 
              prior notice, for any breach of these Terms. Upon termination, your right to use the 
              Service will cease immediately. Data stored locally on your device will remain until 
              you choose to delete it.
            </p>
          </section>

          {/* Changes to Terms */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify or replace these Terms at any time. If a revision is 
              material, we will provide notice prior to any new terms taking effect. What constitutes 
              a material change will be determined at our sole discretion. The "Last updated" date 
              at the top of this page indicates when these Terms were last revised.
            </p>
          </section>

          {/* Governing Law */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
              <Gavel className="w-5 h-5 text-primary" />
              Governing Law
            </h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of England 
              and Wales. Any disputes arising from these Terms or your use of the Service shall be 
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          {/* Contact */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact the organisation that 
              deployed this Tool for your use.
            </p>
          </section>

          {/* Links */}
          <section className="p-6 rounded-xl border bg-card">
            <h2 className="text-xl font-semibold mb-4">Related Documents</h2>
            <div className="flex flex-wrap gap-4">
              <a 
                href="#/privacy" 
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Shield className="w-4 h-4" />
                Privacy Policy
              </a>
            </div>
          </section>

        </motion.div>
      </motion.div>
    </div>
  );
}
