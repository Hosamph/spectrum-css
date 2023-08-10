# <%= name %>

> <%= description %>

## Installation

```sh
yarn add -D <%= name %>
```

Via the command line:

```sh
postcss -u <%= name %> -o dist/index.css src/index.css
```

In the postcss config:

```js
require("<%= name %>")({});
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to see changed.

## License

Copyright 2023 Adobe. All rights reserved.

This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at <http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
