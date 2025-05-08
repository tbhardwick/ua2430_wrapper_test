{
  "targets": [
    {
      "target_name": "ua2430",
      "sources": [ "ua2430_wrap.cxx" ],
      "include_dirs": [ "vendor/include" ],
      "msvs_settings": {
        "VCLinkerTool": {
          "AdditionalDependencies": [
            "../vendor/lib/win-x64/BTICARD64.LIB",
            "../vendor/lib/win-x64/BTI42964.LIB",
            "%(AdditionalDependencies)"
          ],
          "AdditionalLibraryDirectories": [
            "../vendor/lib/win-x64",
            "%(AdditionalLibraryDirectories)"
          ]
        }
      }
    }
  ]
} 