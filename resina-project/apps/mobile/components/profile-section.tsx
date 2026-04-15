import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MobileSectionHeader, SectionSyncBadge, type SectionSyncBadgeVariant } from "./mobile-section-header";

export type ProfileAvatarKey = "boy" | "man" | "user" | "woman" | "woman2";

export type ProfileState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  residentStatus: "resident" | "non_resident";
  addressPurok: string;
  role: string;
  avatarKey: ProfileAvatarKey;
};

export type ProfileAvatarOption = {
  key: ProfileAvatarKey;
  label: string;
  source: ReturnType<typeof require>;
};

type ProfileSectionProps = {
  profileState: ProfileState;
  displayRoleLabel: string;
  residentStatusCaption: string;
  selectedAvatar: ProfileAvatarOption;
  avatarOptions: ProfileAvatarOption[];
  isAvatarPickerOpen: boolean;
  onToggleAvatarPicker: () => void;
  onSelectAvatar: (avatarKey: ProfileAvatarKey) => void;
  isSavingAvatar: boolean;
  isPasswordEditorOpen: boolean;
  onTogglePasswordEditor: () => void;
  passwordForm: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  onPasswordFormChange: (nextForm: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void;
  onSavePassword: () => void;
  isChangingPassword: boolean;
  isRecoveryPasswordFlow?: boolean;
  showNewPassword: boolean;
  onToggleShowNewPassword: () => void;
  showConfirmPassword: boolean;
  onToggleShowConfirmPassword: () => void;
  isEditingPhoneNumber: boolean;
  onToggleEditPhoneNumber: () => void;
  onChangePhoneNumber: (value: string) => void;
  onSavePhoneNumber: () => void;
  isSavingPhoneNumber: boolean;
  isEditingAddress: boolean;
  onToggleEditAddress: () => void;
  onChangeAddress: (value: string) => void;
  onSaveAddressPurok: () => void;
  isSavingAddress: boolean;
  onLogout: () => void;
  title?: string;
  subtitle?: string;
  textVariant?: "light" | "dark";
  statusLabel?: string | null;
  statusVariant?: SectionSyncBadgeVariant;
};

export function ProfileSection({
  profileState,
  displayRoleLabel,
  residentStatusCaption,
  selectedAvatar,
  avatarOptions,
  isAvatarPickerOpen,
  onToggleAvatarPicker,
  onSelectAvatar,
  isSavingAvatar,
  isPasswordEditorOpen,
  onTogglePasswordEditor,
  passwordForm,
  onPasswordFormChange,
  onSavePassword,
  isChangingPassword,
  isRecoveryPasswordFlow = false,
  showNewPassword,
  onToggleShowNewPassword,
  showConfirmPassword,
  onToggleShowConfirmPassword,
  isEditingPhoneNumber,
  onToggleEditPhoneNumber,
  onChangeAddress,
  onSaveAddressPurok,
  isEditingAddress,
  onToggleEditAddress,
  isSavingAddress,
  onLogout,
  title = "PROFILE",
  subtitle = "Profile, alerts, and account settings.",
  textVariant = "dark",
  statusLabel,
  statusVariant = "neutral",
  onChangePhoneNumber,
  onSavePhoneNumber,
  isSavingPhoneNumber,
}: ProfileSectionProps) {
  const isLightText = textVariant === "light";

  return (
    <View>
      <MobileSectionHeader title={title} textVariant={textVariant} />
      <Text style={[styles.subtitle, isLightText ? styles.subtitleLight : null]}>{subtitle}</Text>
      {statusLabel ? <SectionSyncBadge label={statusLabel} variant={statusVariant} /> : null}

      <View style={styles.profileCard}>
        <Image source={selectedAvatar.source} style={styles.profileAvatar} resizeMode="cover" />
        <View style={styles.profileInfoCol}>
          <Text style={styles.profileName}>{profileState.fullName}</Text>
          <View style={styles.profileRoleRow}>
            <Text style={styles.profileRoleBadge}>{displayRoleLabel}</Text>
            <Text style={styles.profileRoleText}>{residentStatusCaption}</Text>
          </View>
        </View>
        <Pressable style={styles.profileInlineEditBtn} onPress={onToggleAvatarPicker}>
          <Text style={styles.profileInlineEditText}>{isAvatarPickerOpen ? "✕" : "✎"}</Text>
        </Pressable>
      </View>

      {isAvatarPickerOpen ? (
        <View style={styles.avatarPickerCard}>
          <Text style={styles.avatarPickerTitle}>Choose your profile avatar</Text>
          <View style={styles.avatarGrid}>
            {avatarOptions.map((item) => {
              const isSelected = item.key === profileState.avatarKey;

              return (
                <Pressable
                  key={item.key}
                  style={[styles.avatarOption, isSelected && styles.avatarOptionActive]}
                  onPress={() => onSelectAvatar(item.key)}
                  disabled={isSavingAvatar}
                >
                  <Image source={item.source} style={styles.avatarOptionImage} resizeMode="cover" />
                </Pressable>
              );
            })}
          </View>
          {isSavingAvatar ? <Text style={styles.avatarSavingText}>Saving avatar...</Text> : null}
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, isLightText ? styles.sectionTitleLight : null]}>Contact Details</Text>
      <View style={styles.profileInfoCard}>
        <View style={styles.profileInfoRow}>
          <View style={styles.profileInfoHeadingRow}>
            <Text style={styles.profileInfoLabel}>Phone Number</Text>
            <View style={styles.profileInfoHeadingActions}>
              <Text style={styles.profilePill}>SMS Active</Text>
              <Pressable onPress={onToggleEditPhoneNumber} style={styles.profileInlineEditBtnSmall}>
                <Text style={styles.profileInlineEditTextSmall}>{isEditingPhoneNumber ? "✓" : "✎"}</Text>
              </Pressable>
            </View>
          </View>
          {isEditingPhoneNumber ? (
            <TextInput
              value={profileState.phoneNumber}
              onChangeText={onChangePhoneNumber}
              onBlur={onSavePhoneNumber}
              style={styles.profilePhoneInput}
              placeholder="0912 345 6789"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              editable={!isSavingPhoneNumber}
              autoFocus
            />
          ) : (
            <Text style={styles.profileInfoValue}>{profileState.phoneNumber}</Text>
          )}
        </View>
        <View style={styles.profileInfoDivider} />
        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Email Address</Text>
          <Text style={styles.profileInfoValue}>{profileState.email}</Text>
        </View>
        {profileState.residentStatus === "resident" ? (
          <>
            <View style={styles.profileInfoDivider} />
            <View style={styles.profileInfoRow}>
              <View style={styles.profileInfoHeadingRow}>
                <Text style={styles.profileInfoLabel}>Address / Purok</Text>
                <Pressable onPress={onToggleEditAddress} style={styles.profileInlineEditBtnSmall}>
                  <Text style={styles.profileInlineEditTextSmall}>{isEditingAddress ? "✓" : "✎"}</Text>
                </Pressable>
              </View>
              {isEditingAddress ? (
                <TextInput
                  value={profileState.addressPurok}
                  onChangeText={onChangeAddress}
                  onBlur={onSaveAddressPurok}
                  style={styles.profileAddressInput}
                  placeholder="Purok 4, Riverside St."
                  placeholderTextColor="#9ca3af"
                  editable={!isSavingAddress}
                  autoFocus
                />
              ) : (
                <Text style={styles.profileInfoValue}>{profileState.addressPurok || "-"}</Text>
              )}
            </View>
          </>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, isLightText ? styles.sectionTitleLight : null]}>Change Password</Text>
      <View style={styles.passwordChangeRow}>
        <Text style={styles.passwordMask}>{isPasswordEditorOpen ? "Enter new password" : "********"}</Text>
        <View style={styles.passwordActions}>
          <Pressable onPress={onTogglePasswordEditor}>
            <Text style={styles.passwordActionIcon}>✎</Text>
          </Pressable>
        </View>
      </View>

      {isPasswordEditorOpen ? (
        <View style={styles.profilePasswordCard}>
          {isRecoveryPasswordFlow ? (
            <Text style={styles.recoveryHint}>Recovery mode active. Set a new password for your account.</Text>
          ) : (
            <>
              <Text style={styles.profileInfoLabel}>Current Password</Text>
              <TextInput
                value={passwordForm.currentPassword}
                onChangeText={(value) => onPasswordFormChange({ ...passwordForm, currentPassword: value })}
                style={styles.profilePasswordInput}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Enter current password"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}

          <Text style={[styles.profileInfoLabel, styles.profilePasswordLabelSpacing]}>New Password</Text>
          <TextInput
            value={passwordForm.newPassword}
            onChangeText={(value) => onPasswordFormChange({ ...passwordForm, newPassword: value })}
            style={styles.profilePasswordInput}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            placeholder="Enter new password"
            placeholderTextColor="#9ca3af"
          />
          <Pressable style={styles.passwordToggleMini} onPress={onToggleShowNewPassword}>
            <Text style={styles.passwordToggleMiniText}>{showNewPassword ? "Hide" : "Show"}</Text>
          </Pressable>

          <Text style={[styles.profileInfoLabel, styles.profilePasswordLabelSpacing]}>Confirm Password</Text>
          <TextInput
            value={passwordForm.confirmPassword}
            onChangeText={(value) => onPasswordFormChange({ ...passwordForm, confirmPassword: value })}
            style={styles.profilePasswordInput}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            placeholder="Confirm new password"
            placeholderTextColor="#9ca3af"
          />
          <Pressable style={styles.passwordToggleMini} onPress={onToggleShowConfirmPassword}>
            <Text style={styles.passwordToggleMiniText}>{showConfirmPassword ? "Hide" : "Show"}</Text>
          </Pressable>

          <Pressable
            style={[styles.profilePasswordSaveBtn, isChangingPassword ? styles.profilePasswordSaveBtnDisabled : null]}
            onPress={onSavePassword}
            disabled={isChangingPassword}
          >
            <Text style={styles.profilePasswordSaveText}>{isChangingPassword ? "Updating..." : "Update Password"}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.alertCard}>
        <Text style={styles.alertCardTitle}>Alert Notifications</Text>
        <Text style={styles.alertCardBody}>
          Your primary phone number is registered for automated SMS alerts. In case of spills or critical levels, you
          will be notified immediately.
        </Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout from Device</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 2,
    marginBottom: 10,
    color: "#60748f",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  subtitleLight: {
    color: "#c7d7ee",
  },
  profileCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  profileInfoCol: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "700",
  },
  profileInlineEditBtn: {
    position: "absolute",
    right: 12,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  profileInlineEditText: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "700",
  },
  profileInfoHeadingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileInlineEditBtnSmall: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  profileInlineEditTextSmall: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  profileRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  profileRoleBadge: {
    color: "#111827",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
  },
  profileRoleText: {
    marginLeft: 8,
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "500",
  },
  avatarPickerCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#f9fbfd",
    padding: 14,
    marginBottom: 12,
  },
  avatarPickerTitle: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  avatarOption: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  avatarOptionActive: {
    borderColor: "#2f8d41",
  },
  avatarOptionImage: {
    width: "100%",
    height: "100%",
  },
  avatarSavingText: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 12,
  },
  sectionTitle: {
    color: "#20232c",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionTitleLight: {
    color: "#e5efff",
    textShadowColor: "rgba(5, 12, 24, 0.24)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileInfoCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
  },
  profileInfoRow: {
    marginBottom: 0,
  },
  profileInfoHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  profileInfoLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  profilePill: {
    color: "#1f2937",
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  profileInfoValue: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "600",
  },
  profileInfoDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 10,
  },
  profileAddressInput: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 10,
    backgroundColor: "#f9fbfd",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#1f2937",
    fontSize: 14,
  },
  passwordChangeRow: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  passwordMask: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
  },
  passwordActions: {
    flexDirection: "row",
    gap: 10,
  },
  passwordActionIcon: {
    color: "#4b5563",
    fontSize: 16,
    fontWeight: "700",
  },
  profilePasswordCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#f9fbfd",
    padding: 14,
    marginBottom: 12,
  },
  recoveryHint: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  profilePasswordInput: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#1f2937",
    fontSize: 14,
  },
  profilePasswordLabelSpacing: {
    marginTop: 10,
  },
  passwordToggleMini: {
    alignSelf: "flex-end",
    marginTop: 6,
    marginBottom: 4,
  },
  passwordToggleMiniText: {
    color: "#2f8d41",
    fontSize: 12,
    fontWeight: "700",
  },
  profilePasswordSaveBtn: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#2f8d41",
    paddingVertical: 12,
    alignItems: "center",
  },
  profilePasswordSaveBtnDisabled: {
    opacity: 0.65,
  },
  profilePasswordSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  alertCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
  },
  alertCardTitle: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  alertCardBody: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
  },
  logoutButton: {
    borderRadius: 14,
    backgroundColor: "#efe2e5",
    borderWidth: 1,
    borderColor: "#e1c5cc",
    paddingVertical: 13,
    alignItems: "center",
  },
  logoutText: {
    color: "#7f1d1d",
    fontSize: 14,
    fontWeight: "800",
  },
});
