"use client";

import { useMemo, useState } from "react";
import { JetBrains_Mono, Sora } from "next/font/google";
import { AnimatePresence, motion } from "framer-motion";
import AdminShell from "./_components/AdminShell";
import AddTeamModal from "./_components/AddTeamModal";
import AdminTopBar from "./_components/AdminTopBar";
import AnalyticsPanel from "./_components/AnalyticsPanel";
import DetailDrawer from "./_components/DetailDrawer";
import EventControlsQuickAccess from "./_components/EventControlsQuickAccess";
import EventControlsWorkspaceModal from "./_components/EventControlsWorkspaceModal";
import FilterBar from "./_components/FilterBar";
import LoadingState from "./_components/LoadingState";
import OperationsRail from "./_components/OperationsRail";
import RegistrationsTable from "./_components/RegistrationsTable";
import ResultsMeta from "./_components/ResultsMeta";
import RuntimeNotice from "./_components/RuntimeNotice";
import ScreenshotPreviewModal from "./_components/ScreenshotPreviewModal";
import SummaryCards from "./_components/SummaryCards";
import { useAdminDashboard } from "./_hooks/useAdminDashboard";
import { TRACK_OPTIONS } from "./_lib/adminData";
import styles from "./admin-v2.module.css";

const adminSans = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-admin-sans",
});

const adminMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-admin-mono",
});

const transitionEase = [0.22, 1, 0.36, 1];

const sectionMotion = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: transitionEase },
  },
};

function DuplicateNotice({ duplicates }) {
  if (!duplicates?.dupNames?.size && !duplicates?.dupTx?.size) {
    return null;
  }

  const dupNames = [...duplicates.dupNames].map((item) => item.toUpperCase());
  const dupTx = [...duplicates.dupTx].map((item) => item.toUpperCase());

  return (
    <section className={styles.duplicateNotice} aria-label="Duplicate detection notice">
      <p className={styles.duplicateNoticeTitle}>Duplicate records detected</p>

      {dupNames.length > 0 ? (
        <p className={styles.duplicateNoticeText}>
          Duplicate team names: {dupNames.join(", ")}
        </p>
      ) : null}

      {dupTx.length > 0 ? (
        <p className={styles.duplicateNoticeText}>
          Duplicate transaction IDs: {dupTx.join(", ")}
        </p>
      ) : null}
    </section>
  );
}

export default function AdminV2Page() {
  const dashboard = useAdminDashboard();
  const [eventControlsOpen, setEventControlsOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);

  const openEventControlsWorkspace = () => {
    setEventControlsOpen(true);
    void dashboard.fetchEventControls();
  };

  const closeEventControlsWorkspace = () => {
    if (dashboard.eventControlsSaving) {
      return;
    }

    setEventControlsOpen(false);
  };

  const openAddTeamWorkspace = () => {
    dashboard.resetAddTeamError();
    setAddTeamOpen(true);
  };

  const closeAddTeamWorkspace = () => {
    if (dashboard.addTeamBusy) {
      return;
    }

    dashboard.resetAddTeamError();
    setAddTeamOpen(false);
  };

  const activeTrackLabel = useMemo(() => {
    const activeOption = TRACK_OPTIONS.find((option) => option.value === dashboard.filterTrack);
    return activeOption?.label || String(dashboard.filterTrack || "").toUpperCase();
  }, [dashboard.filterTrack]);

  if (dashboard.loading) {
    return (
      <AdminShell className={`${adminSans.variable} ${adminMono.variable}`}>
        <LoadingState message="Loading admin workspace..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell className={`${adminSans.variable} ${adminMono.variable}`}>
      <div className={styles.layoutGrid}>
        <OperationsRail
          userEmail={dashboard.user?.email}
          activeTrackLabel={activeTrackLabel}
          activeTab={dashboard.activeTab}
          onChangeTab={dashboard.setActiveTab}
          stats={dashboard.stats}
          filterTrack={dashboard.filterTrack}
          credentialSheetUrl={dashboard.credentialSheetUrl}
          apiRuntimeAvailable={dashboard.apiRuntimeAvailable}
          onOpenAddTeam={openAddTeamWorkspace}
          onOpenEventControls={openEventControlsWorkspace}
          onExportCSV={dashboard.exportCSV}
          onLogout={dashboard.handleLogout}
        />

        <div className={styles.mainColumn}>
          <motion.div {...sectionMotion}>
            <AdminTopBar
              userEmail={dashboard.user?.email}
              activeTrackLabel={activeTrackLabel}
              apiRuntimeAvailable={dashboard.apiRuntimeAvailable}
              credentialSheetUrl={dashboard.credentialSheetUrl}
              onOpenAddTeam={openAddTeamWorkspace}
              onOpenEventControls={openEventControlsWorkspace}
              onExportCSV={dashboard.exportCSV}
              onLogout={dashboard.handleLogout}
            />
          </motion.div>

          <motion.main
            className={styles.workspace}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.36, ease: transitionEase } }}
          >
            <section className={styles.intelligenceStrip}>
              <RuntimeNotice
                tone="danger"
                title="Data sync issue"
                message={dashboard.dataError}
              />

              <RuntimeNotice
                tone="warning"
                title="Runtime mode notice"
                message={dashboard.runtimeNotice}
              />

              <motion.div
                className={styles.trackTransitionLayer}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, ease: transitionEase }}
              >
                <SummaryCards stats={dashboard.stats} filterTrack={dashboard.filterTrack} />
              </motion.div>

              <motion.div
                className={styles.trackTransitionLayer}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: transitionEase }}
              >
                <EventControlsQuickAccess
                  effectiveState={dashboard.eventControlsEffectiveState}
                  timezoneLabel={dashboard.eventControlTimezoneLabel}
                  loading={dashboard.eventControlsLoading}
                  error={dashboard.eventControlsError}
                  onOpen={openEventControlsWorkspace}
                />
              </motion.div>
            </section>

            <section className={styles.stickyControls}>
              <div className={styles.viewTabs} role="tablist" aria-label="Dashboard views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={dashboard.activeTab === "table"}
                  className={`${styles.viewTab} ${
                    dashboard.activeTab === "table" ? styles.viewTabActive : ""
                  }`.trim()}
                  onClick={() => dashboard.setActiveTab("table")}
                >
                  Registrations table
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={dashboard.activeTab === "analytics"}
                  className={`${styles.viewTab} ${
                    dashboard.activeTab === "analytics" ? styles.viewTabActive : ""
                  }`.trim()}
                  onClick={() => dashboard.setActiveTab("analytics")}
                >
                  Analytics
                </button>
              </div>

              <FilterBar
                filterTrack={dashboard.filterTrack}
                trackOptions={TRACK_OPTIONS}
                onTrackChange={dashboard.updateTrack}
                trackSwitching={dashboard.isTrackSwitching}
                searchTerm={dashboard.searchTerm}
                onSearchChange={dashboard.updateSearch}
                filterSize={dashboard.filterSize}
                sizeOptions={dashboard.sizeOptions}
                onSizeChange={dashboard.updateSizeFilter}
                filterCollege={dashboard.filterCollege}
                collegeList={dashboard.collegeList}
                onCollegeChange={dashboard.updateCollegeFilter}
                filterEmailState={dashboard.filterEmailState}
                onEmailStateChange={dashboard.updateEmailStateFilter}
              />

              <ResultsMeta
                paginatedCount={dashboard.paginated.length}
                filteredCount={dashboard.filtered.length}
                currentPage={dashboard.currentPage}
                totalPages={dashboard.totalPages}
                bulkSendBusy={dashboard.bulkSendBusy}
                bulkSendCandidateCount={dashboard.bulkSendCandidateIds.length}
                apiRuntimeAvailable={dashboard.apiRuntimeAvailable}
                bulkActionMessage={dashboard.bulkActionMessage}
                onBulkSend={() => {
                  void dashboard.handleBulkSendUnsent();
                }}
              />
            </section>

            <DuplicateNotice duplicates={dashboard.duplicates} />

            <motion.div
              className={styles.trackTransitionLayer}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14, ease: transitionEase }}
            >
              {dashboard.activeTab === "table" ? (
                <RegistrationsTable
                  rows={dashboard.paginated}
                  currentPage={dashboard.currentPage}
                  totalPages={dashboard.totalPages}
                  onPageChange={dashboard.setCurrentPage}
                  formatDateTime={dashboard.formatDateTime}
                  isDupName={dashboard.isDupName}
                  isDupTx={dashboard.isDupTx}
                  onSelectTeam={dashboard.openTeamDetail}
                  onSendCredentialEmail={dashboard.handleSendCredentialEmail}
                  emailActionBusyId={dashboard.emailActionBusyId}
                  deleteActionBusyId={dashboard.deleteActionBusyId}
                  bulkSendBusy={dashboard.bulkSendBusy}
                  apiRuntimeAvailable={dashboard.apiRuntimeAvailable}
                  onDeleteRegistration={dashboard.handleDeleteRegistration}
                  onOpenScreenshotPreview={dashboard.openScreenshotPreview}
                />
              ) : (
                <AnalyticsPanel
                  analyticsData={dashboard.analyticsData}
                  filterTrack={dashboard.filterTrack}
                />
              )}
            </motion.div>
          </motion.main>
        </div>
      </div>

      <AnimatePresence>
        {addTeamOpen ? (
          <AddTeamModal
            key="admin-add-team-modal"
            isOpen={addTeamOpen}
            busy={dashboard.addTeamBusy}
            error={dashboard.addTeamError}
            onClose={closeAddTeamWorkspace}
            onResetError={dashboard.resetAddTeamError}
            onSubmit={(payload) => dashboard.handleAddTeam(payload)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {eventControlsOpen ? (
          <EventControlsWorkspaceModal
            key="event-controls-workspace"
            isOpen={eventControlsOpen}
            onClose={closeEventControlsWorkspace}
            controls={dashboard.eventControls}
            effectiveState={dashboard.eventControlsEffectiveState}
            timezoneLabel={dashboard.eventControlTimezoneLabel}
            loading={dashboard.eventControlsLoading}
            saving={dashboard.eventControlsSaving}
            error={dashboard.eventControlsError}
            message={dashboard.eventControlsMessage}
            onRefresh={() => {
              void dashboard.fetchEventControls();
            }}
            onChangeDraft={(nextControls) => {
              dashboard.updateEventControlsDraft(nextControls);
            }}
            onSave={(nextControls) => {
              void dashboard.saveEventControls(nextControls);
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dashboard.selectedTeam ? (
          <DetailDrawer
            key="admin-detail-drawer"
            team={dashboard.selectedTeam}
            noteText={dashboard.noteText}
            onNoteChange={dashboard.setNoteText}
            onClose={dashboard.closeTeamDetail}
            onStatusToggle={dashboard.handleStatusToggle}
            onRegenerateCredentials={dashboard.handleRegenerateCredentials}
            onSendCredentialEmail={dashboard.handleSendCredentialEmail}
            onSaveNotes={dashboard.handleSaveNotes}
            onOpenScreenshotPreview={dashboard.openScreenshotPreview}
            formatDateTime={dashboard.formatDateTime}
            actionError={dashboard.actionError}
            updateBusy={dashboard.updateBusy}
            emailActionBusyId={dashboard.emailActionBusyId}
            bulkSendBusy={dashboard.bulkSendBusy}
            selectedCanSendCredentialEmail={dashboard.selectedCanSendCredentialEmail}
            selectedShouldForceResend={dashboard.selectedShouldForceResend}
            selectedEmailDelivery={dashboard.selectedEmailDelivery}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dashboard.previewScreenshot?.url ? (
          <ScreenshotPreviewModal
            key="admin-screenshot-preview"
            previewScreenshot={dashboard.previewScreenshot}
            onClose={dashboard.closeScreenshotPreview}
          />
        ) : null}
      </AnimatePresence>
    </AdminShell>
  );
}
