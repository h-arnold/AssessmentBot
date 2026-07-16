import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./e2e-css-loader.mjs', pathToFileURL('./'));
