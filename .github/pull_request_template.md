# Pull Request

## 📝 Description

<!-- Provide a brief description of the changes in this pull request -->

## 🧪 Testing

<!-- Describe how you tested these changes -->

- [ ] Tested in Google Apps Script Editor
- [ ] Unit tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Manual testing completed with mock data

## 📋 Checklist

Please confirm you have completed the following:

### Code Quality
- [ ] **No eager heavy work in top-level scope** - No expensive operations (Drive/Properties/Classroom access) during file load or object construction
- [ ] **Singleton pattern followed** - Used `Class.getInstance()` instead of `new Class()` for singleton classes
- [ ] **Code follows style guide** - Adheres to the formatting and naming conventions in CONTRIBUTING.md
- [ ] **JSDoc comments added** - Public methods and classes have appropriate documentation

### Testing & Validation
- [ ] **Changes tested thoroughly** - Code works correctly in Google Apps Script environment
- [ ] **Existing tests still pass** - No regressions introduced
- [ ] **New tests added** - For new functionality (if applicable)
- [ ] **Singleton tests pass** - If modifying singleton classes, lazy initialization verified

### Documentation
- [ ] **Documentation updated** - README, setup guides, or other docs updated as needed
- [ ] **Breaking changes noted** - Any API changes or migration steps documented

## 🎯 Type of Change

<!-- Mark the appropriate option -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔨 Refactoring (no functional changes)
- [ ] 🧪 Test improvements
- [ ] 🏗️ Build/infrastructure changes

## 📚 Additional Notes

<!-- Any additional context, screenshots, or notes for reviewers -->

---

Thank you for contributing to AssessmentBot! 🚀