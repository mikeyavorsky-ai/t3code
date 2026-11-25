const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["com.apple.developer.associated-domains"];
    delete mod.modResults["aps-environment"];
    delete mod.modResults["com.apple.developer.applesignin"];
    return mod;
  });
