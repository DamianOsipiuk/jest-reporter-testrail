[![NPM](https://img.shields.io/npm/v/jest-reporter-testrail)](https://www.npmjs.com/package/jest-reporter-testrail) [![NPM](https://img.shields.io/npm/l/jest-reporter-testrail)](https://github.com/DamianOsipiuk/jest-reporter-testrail/blob/master/LICENSE) [![NPM](https://img.shields.io/node/v/jest-reporter-testrail)](https://github.com/DamianOsipiuk/jest-reporter-testrail/blob/master/package.json)

# Description

Reporter plugin that sends test coverage and test results to TestRail

**It does not provide std output, please use with combination with the default reporter**

# Usage

1. Installation

   `npm install jest-reporter-testrail --save-dev`

2. Add reporter to jest configuration. Make sure to also include **default** reporter if **reporters** option was not provided

```
reporters: [
  'default',
  'jest-reporter-testrail'
],
```

3. Provide required options from the configuration section

# Configuration

Configuration can be provided via:

- ENV variables
- configuration file (.testrailrc)
- reporter options in jest config

  `reporters: [ 'default', ['jest-reporter-testrail', {option1: '', option2: ''}] ],`

Both configuration file and reporter options use the same schema.

| ENV Variable              | Config         | Description                                                                                                                                                                                                                                                                                                            |           Default           | Required |
| ------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------: | :------: |
| TESTRAIL_ENABLE           | enabled        | Enables TestRail integration.                                                                                                                                                                                                                                                                                          |           `false`           |          |
| TESTRAIL_HOST             | host           | URL of the TestRail instance.                                                                                                                                                                                                                                                                                          |                             |  `true`  |
| TESTRAIL_USER             | user           | Account name which will be used to push results.                                                                                                                                                                                                                                                                       |                             |  `true`  |
| TESTRAIL_API_KEY          | apiKey         | API key which can be generated on the profile page in TestRail.                                                                                                                                                                                                                                                        |                             |  `true`  |
| TESTRAIL_PROJECT_ID       | projectId      | Project id in which test cases are stored. Ex. `P123`                                                                                                                                                                                                                                                                  |                             |  `true`  |
| TESTRAIL_SUITE_ID         | suiteId        | Suite id in which test cases are stored. Ex. `S123`                                                                                                                                                                                                                                                                    |                             |  `true`  |
| TESTRAIL_COVERAGE_CASE_ID | coverageCaseId | Test Case ID which will be used to post test results. It will appear in Test Run as executed with coverage and results as description.                                                                                                                                                                                 |                             |  `true`  |
| TESTRAIL_RUN_NAME         | runName        | Test Run name. Configurable with variables <ul><li>`%BRANCH%` - see config option `branchEnv`</li><li>`%BUILD%` - see config option `buildNoEnv`</li><li>`%DATE%` - see config option `dateFormat`</li></ul>                                                                                                           | `%BRANCH%#%BUILD% - %DATE%` |          |
| TESTRAIL_RUN_DESCRIPTION  | runDescription | You can provide you own Test Run description. If this option is not configured, it will contain test results and test coverage.                                                                                                                                                                                        |                             |          |
| TESTRAIL_REFERENCE        | reference      | String that will be added to the `refs` field in TestRail. This can enable integration with other tools like https://github.com/DamianOsipiuk/testcafe-reporter-testrail/. Configurable with variables <ul><li>`%BRANCH%` - see config option `branchEnv`</li><li>`%BUILD%` - see config option `buildNoEnv`</li></ul> |                             |          |
| TESTRAIL_BRANCH_ENV       | branchEnv      | Which ENV variable is used to store branch name on which tests are run.                                                                                                                                                                                                                                                |          `BRANCH`           |          |
| TESTRAIL_BUILD_NO_ENV     | buildNoEnv     | Which ENV variable is used to store build number of tests run.                                                                                                                                                                                                                                                         |       `BUILD_NUMBER`        |          |
| TESTRAIL_DATE_FORMAT      | dateFormat     | What date format should be used for `%DATE%` placeholder. https://momentjs.com/ formats supported.                                                                                                                                                                                                                     |    `YYYY-MM-DD HH:mm:ss`    |          |
