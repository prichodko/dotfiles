#!/usr/bin/env bash

# XCode command line tools
# thx https://github.com/alrra/dotfiles/blob/ff123ca9b9b/os/os_x/installs/install_xcode.sh

if ! xcode-select --print-path &> /dev/null; then

    # Prompt user to install the XCode Command Line Tools
    xcode-select --install &> /dev/null

    # Wait until the XCode Command Line Tools are installed
    until xcode-select --print-path &> /dev/null; do
        sleep 5
    done

    print_result $? 'Install XCode Command Line Tools'

    # Point the `xcode-select` developer directory to
    # the appropriate directory from within `Xcode.app`
    # https://github.com/alrra/dotfiles/issues/13
    sudo xcode-select -switch /Applications/Xcode.app/Contents/Developer
    print_result $? 'Make "xcode-select" developer directory point to Xcode'

    # Prompt user to agree to the terms of the Xcode license
    # https://github.com/alrra/dotfiles/issues/10
    sudo xcodebuild -license
    print_result $? 'Agree with the XCode Command Line Tools licence'

fi

# Homebrew
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

## Internal
brew install bash
brew install bash-completion@2
brew install homebrew/core/brew-cask-completion

brew intall git
brew intall node
brew install yarn
brew install wifi-password
brew install diff-so-fancy
brew install fasd

# Homebrew Cask
brew tap caskroom/cask
brew tap caskroom/versions # alternate cask versions

## Everyday
brew cask install spectacle
brew cask install spotify
brew cask install slack
brew cask install flux

## Browsers
brew cask install google-chrome
brew cask install google-chrome-canary
brew cask install firefox-nightly
brew cask install google-backup-and-sync

## Dev
brew cask install hyper
brew cask install visual-studio-code
brew cask install postman
brew cask install sketch
brew cask install now

# npm
npm i -g git-open
npm i -g now
npm i -g np
npm i -g release
npm i -g prettier
npm i -g svgr
npm i -g historie
npm i -g npm-check
