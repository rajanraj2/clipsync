class Clipsync < Formula
  desc "Universal clipboard, synchronization and content sharing CLI"
  homepage "https://github.com/rajanraj2/clipsync"
  url "https://github.com/rajanraj2/clipsync/releases/download/v0.1.0/clipsync-cli-0.1.0.tar.gz"
  sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" # Updated on release
  license "MIT"
  head "https://github.com/rajanraj2/clipsync.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "ClipSync CLI", shell_output("#{bin}/clipsync --version")
  end
end
