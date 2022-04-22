/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const StyleDictionary = require('style-dictionary');
const CSSSetsFormatter = require('style-dictionary-sets').CSSSetsFormatter;
const NameKebabTransfom = require('style-dictionary-sets').NameKebabTransfom;
const AttributeSetsTransform =
  require('style-dictionary-sets').AttributeSetsTransform;

StyleDictionary.registerTransform(NameKebabTransfom);
StyleDictionary.registerTransform(AttributeSetsTransform);
StyleDictionary.registerFormat(CSSSetsFormatter);

const systemNames = ['express', 'spectrum', 'wireframe'];

const tokenAttributesHaveSets = (tokenAttributes) => {
  return typeof tokenAttributes === 'object' &&
    !Array.isArray(tokenAttributes) &&
    tokenAttributes !== null &&
    'sets' in tokenAttributes;
}

const generateFileConfig = (setName, subSystemName) => {
  const sets = [setName, subSystemName];

  const selectorMap = {
    'desktop': 'medium',
    'mobile': 'large'
  };

  const fileName = selectorMap[setName] ?? setName;

  let selector = `.spectrum--${fileName}`;
  if (subSystemName !== 'spectrum') {
    selector = `.spectrum--${subSystemName}${selector}`;
  }

  return {
    destination: `${subSystemName}/${fileName}-vars.css`,
    format: CSSSetsFormatter.name,
    filter: (token) => {
      return (
        tokenAttributesHaveSets(token.attributes) &&
        token.attributes.sets.includes(subSystemName) &&
        token.attributes.sets.includes(setName)
      );
    },
    options: {
      selector,
      showFileHeader: false,
      outputReferences: true,
      sets
    },
  }
};

const generateGlobalConfig = (subSystemName) => {
  const sets = [subSystemName];

  const selector = subSystemName === 'spectrum' ? '.spectrum' : `.spectrum--${subSystemName}`;

  return {
    destination: `${subSystemName}/global-vars.css`,
    format: CSSSetsFormatter.name,
    filter: (token) => {
      return (
        tokenAttributesHaveSets(token.attributes) &&
        token.attributes.sets.length === 1 &&
        token.attributes.sets[0] === subSystemName
      );
    },
    options: {
      selector,
      showFileHeader: false,
      outputReferences: true,
      sets
    },
  }
}

const generateGlobalSetConfig = (setName) => {
  const sets = [setName];

  const selectorMap = {
    'desktop': 'medium',
    'mobile': 'large'
  };

  const selector = selectorMap[setName] ?? setName;
  return {
    destination: `${selector}-vars.css`,
    format: CSSSetsFormatter.name,
    filter: (token) => {
      return (
        tokenAttributesHaveSets(token.attributes) &&
        token.attributes.sets.every(set => !systemNames.includes(set)) &&
        token.attributes.sets.includes(setName)
      );
    },
    options: {
      selector: `.spectrum--${selector}`,
      showFileHeader: false,
      outputReferences: true,
      sets
    },
  }
}

module.exports = {
  source: ['node_modules/@adobe/spectrum-tokens/src/**/*.json'],
  platforms: {
    CSS: {
      buildPath: 'dist/css/',
      transforms: [AttributeSetsTransform.name, NameKebabTransfom.name],
      prefix: 'spectrum',
      files: [
        {
          destination: 'global-vars.css',
          format: CSSSetsFormatter.name,
          filter: (token) => {
            return !('sets' in token.attributes)
          },
          options: {
            showFileHeader: false,
            outputReferences: true,
            selector: '.spectrum'
          },
        },
        generateGlobalSetConfig('desktop'),
        generateGlobalSetConfig('mobile'),
        generateGlobalSetConfig('light'),
        generateGlobalSetConfig('dark'),
        generateGlobalSetConfig('darkest'),

        generateGlobalConfig('spectrum'),
        generateFileConfig('desktop', 'spectrum'),
        generateFileConfig('mobile', 'spectrum'),
        generateFileConfig('light', 'spectrum'),
        generateFileConfig('dark', 'spectrum'),
        generateFileConfig('darkest', 'spectrum'),

        generateGlobalConfig('express'),
        generateFileConfig('desktop', 'express'),
        generateFileConfig('mobile', 'express'),
        generateFileConfig('light', 'express'),
        generateFileConfig('dark', 'express'),
        generateFileConfig('darkest', 'express'),
      ],
    },
  },
};