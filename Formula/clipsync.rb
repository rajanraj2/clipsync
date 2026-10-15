class Clipsync < Formula
  desc "Universal clipboard, synchronization and content sharing CLI"
  homepage "https://github.com/rajanraj2/clipsync"
  url "https://github.com/rajanraj2/clipsync/releases/download/v0.1.0/clipsync-cli-0.1.0.tgz"
  sha256 "d039046b38620db1e4f790b717b17f688923d6cd6058993d245b52c2cfd65436"
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
