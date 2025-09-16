// z_singletons.gs
// Note that singletons.gs needs to be prefixed with `z` to ensure that it is placed after the classes to avoid xx not defined errors.

// This file creates singleton instances of any classes needed.
// Please instantiate all singleton instances in this file for ease of referral.

const configurationManager = new ConfigurationManager();
const initController = new InitController();
