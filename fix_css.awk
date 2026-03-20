BEGIN { in_block = 0 }
/<style lang="scss">/ { in_block = 1; print; next }
/<\/style>/ { in_block = 0; print; next }
in_block { print }
