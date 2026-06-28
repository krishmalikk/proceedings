const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to add use_modular_headers! to the Podfile
 * This fixes the Swift pod module dependency issue with GoogleUtilities and RecaptchaInterop
 */
const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Check if use_modular_headers! is already present
        if (!podfileContent.includes('use_modular_headers!')) {
          // Add use_modular_headers! after the first line of the target block
          // This ensures it's applied globally
          podfileContent = podfileContent.replace(
            /^(require.*\n)/m,
            `$1\nuse_modular_headers!\n`
          );

          // If that didn't work, try adding it at the top
          if (!podfileContent.includes('use_modular_headers!')) {
            podfileContent = `use_modular_headers!\n\n${podfileContent}`;
          }

          fs.writeFileSync(podfilePath, podfileContent);
        }
      }

      return config;
    },
  ]);
};

module.exports = withModularHeaders;
