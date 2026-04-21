# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.134.0/containers/python-3/.devcontainer/base.Dockerfile
ARG VARIANT="3"
FROM mcr.microsoft.com/vscode/devcontainers/python:0-${VARIANT}

# [Optional] Allow the vscode user to pip install globally w/o sudo
ENV PIP_TARGET=/usr/local/pip-global
ENV PYTHONPATH="${PIP_TARGET}:${PYTHONPATH:-}"
ENV PATH="${PIP_TARGET}/bin:${PATH:-}"

ARG USERNAME=vscode

RUN mkdir -p ${PIP_TARGET} \
    && chown $USERNAME:root ${PIP_TARGET} \
    && echo "if [ \"\$(stat -c '%U' ${PIP_TARGET})\" != \"$USERNAME\" ]; then chown -R $USERNAME:root ${PIP_TARGET}; fi" \
        | tee -a /root/.bashrc "/home/$USERNAME/.bashrc" /root/.zshrc >> "/home/$USERNAME/.zshrc" 

# [Optional] Uncomment this section to install additional OS packages.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends software-properties-common

# Set up bash history
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    && mkdir -p /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R $USERNAME:$USERNAME /commandhistory \
    && echo "$SNIPPET" >> "/home/$USERNAME/.bashrc" \
    && echo "$SNIPPET" >> "/root/.bashrc"
