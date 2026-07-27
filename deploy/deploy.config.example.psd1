@{
  # LAN address or DNS name of the iStoreOS host.
  SshHost = "192.168.1.10"
  SshUser = "root"
  SshPort = 22

  # Optional. Leave empty to let system OpenSSH request the account password.
  IdentityFile = ""

  # Existing repository root on the server and a separate backup directory.
  RemoteReleaseDir = "/mnt/data/home-party-game-platform"
  RemoteBackupDir = "/mnt/data/home-party-game-platform-backup"

  PartyPort = 3000
  HealthTimeoutSeconds = 120
}
