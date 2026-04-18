const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Support hoisted Expo packages while forcing React resolution to mobile-local copies.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, "node_modules"),
	path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
	react: path.resolve(projectRoot, "node_modules/react"),
	"react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
	"react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
