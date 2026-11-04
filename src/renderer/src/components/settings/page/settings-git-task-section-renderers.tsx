import { CommitMessageAiPane } from '../source-control/CommitMessageAiPane'
import { GitPane } from '../source-control/GitPane'
import { SettingsSection } from '../section-layout/SettingsSection'
import { translate } from '@/i18n/i18n'
import type { SettingsRenderContext } from './settings-render-context'

export function renderGitSettingsSection(context: SettingsRenderContext): React.JSX.Element {
  const { model, interactions, navigation, view } = context
  return (
    <SettingsSection
      id="git"
      title={translate('auto.components.settings.Settings.70100f94c7', 'Git & Source Control')}
      description={translate(
        'auto.components.settings.Settings.cfa34f4465',
        'Branch naming, base refs, and Git AI Author.'
      )}
      searchEntries={navigation.getSectionSearchEntries('git')}
      forceVisible={model.hasUnsavedCommitPromptChanges || model.hasUnsavedBranchPromptChanges}
    >
      {view.isSectionMounted('git') ? (
        <>
          <GitPane
            settings={model.settings}
            updateSettings={model.updateSettings}
            writeSourceControlAiSettings={interactions.writeSourceControlAiSettings}
            displayedGitUsername={navigation.displayedGitUsername}
            hasUnsavedBranchPromptChanges={model.hasUnsavedBranchPromptChanges}
            onBranchPromptDirtyChange={model.setHasUnsavedBranchPromptChanges}
            branchPromptDiscardSignal={model.sourceControlAiPromptDiscardSignal}
            settingsSearchQuery={model.settingsSearchQuery}
          />
          <CommitMessageAiPane
            settings={model.settings}
            updateSettings={model.updateSettings}
            writeSourceControlAiSettings={interactions.writeSourceControlAiSettingsOrThrow}
            onCustomPromptDirtyChange={model.setHasUnsavedCommitPromptChanges}
            customPromptDiscardSignal={model.sourceControlAiPromptDiscardSignal}
            settingsSearchQuery={model.settingsSearchQuery}
          />
        </>
      ) : null}
    </SettingsSection>
  )
}
